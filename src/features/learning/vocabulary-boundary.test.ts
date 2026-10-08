import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** Type-aware boundary audit: HTTP and other domains may still use their own status. */
function legacyAccesses(program: ts.Program, file: ts.SourceFile): string[] {
  const checker = program.getTypeChecker(), found: string[] = []
  function isVocabulary(type: ts.Type): boolean {
    if (type.isUnion()) return type.types.some(isVocabulary)
    const property = type.getProperty('status')
    return Boolean(property?.declarations?.some((declaration) => /src\/(features\/learning\/types|domain\/vocabulary)\.ts$/.test(declaration.getSourceFile().fileName.replaceAll('\\', '/'))))
  }
  function key(node: ts.Node | undefined): string | undefined {
    if (!node) return undefined
    if (ts.isComputedPropertyName(node)) return key(node.expression)
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text
    const type = checker.getTypeAtLocation(node)
    return type.isStringLiteral() ? type.value : undefined
  }
  function visit(node: ts.Node) {
    let forbidden = false
    if (ts.isPropertyAccessExpression(node)) forbidden = ['status', 'vocabularyState'].includes(node.name.text) && isVocabulary(checker.getTypeAtLocation(node.expression))
    if (ts.isElementAccessExpression(node)) forbidden = ['status', 'vocabularyState'].includes(key(node.argumentExpression) ?? '') && isVocabulary(checker.getTypeAtLocation(node.expression))
    if (ts.isObjectBindingPattern(node)) forbidden = isVocabulary(checker.getTypeAtLocation(node)) && node.elements.some((binding) => ['status', 'vocabularyState'].includes(key(binding.propertyName ?? binding.name) ?? ''))
    if (ts.isObjectLiteralExpression(node) && node.properties.some((property) => !ts.isSpreadAssignment(property) && ['status', 'vocabularyState'].includes(key(property.name) ?? ''))) {
      const contextual = checker.getContextualType(node)
      forbidden = Boolean(contextual && isVocabulary(contextual)) || node.properties.some((property) => ts.isSpreadAssignment(property) && isVocabulary(checker.getTypeAtLocation(property.expression)))
    }
    if (ts.isIdentifier(node) && ['setLearningStatus', 'writeLearningStatus'].includes(node.text)) forbidden = true
    if (ts.isImportSpecifier(node) && ['serializeLearningTerm', 'createLearningTerm', 'applyVocabularyAction'].includes((node.propertyName ?? node.name).text) && !file.fileName.replaceAll('\\', '/').endsWith('/features/learning/repository.ts')) forbidden = true
    if (forbidden) found.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const virtualPath = resolve('.vocabulary-boundary-fixture.ts')
const fixture = `
import type { LearningTerm } from './src/features/learning/types'
declare const term: LearningTerm
void term.status
void term['status']
const { status: legacy } = term
term.status = 'learning'
const rebuilt: LearningTerm = { ...term, status: 'unknown' }
const computed = { ...term, ['status']: 'active' }
void term.vocabularyState
void ({ status: 200 }).status
void ({ status: 'recovered' })['status']
`
const root = process.cwd(), config = ts.readConfigFile(resolve('tsconfig.app.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const host = ts.createCompilerHost(parsed.options), originalGetSourceFile = host.getSourceFile.bind(host)
host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => resolve(name) === virtualPath ? ts.createSourceFile(name, fixture, languageVersion, true) : originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
const program = ts.createProgram([...parsed.fileNames, virtualPath], parsed.options, host)

describe('production vocabulary compatibility boundary', () => {
  it('detects reads, assignments, destructuring, reconstruction and direct new-state reads', () => {
    const found = legacyAccesses(program, program.getSourceFile(virtualPath)!)
    expect(found).toEqual(["term.status", "term['status']", '{ status: legacy }', 'term.status', "{ ...term, status: 'unknown' }", "{ ...term, ['status']: 'active' }", 'term.vocabularyState'])
  })
  it('allows only the centralized module to interpret/write vocabulary status and state', () => {
    const audited = program.getSourceFiles().filter((file) => {
      const path = file.fileName.replaceAll('\\', '/')
      return path.startsWith(root.replaceAll('\\', '/') + '/src/') && !path.includes('.test.') && !path.includes('/mocks/') && !path.endsWith('/vocabulary-state.ts')
    })
    expect(audited.some((file) => file.fileName.replaceAll('\\', '/').endsWith('/features/learning/repository.ts'))).toBe(true)
    expect(audited.some((file) => file.fileName.replaceAll('\\', '/').endsWith('/features/review/review-service.ts'))).toBe(true)
    const violations = audited.flatMap((file) => legacyAccesses(program, file).map((access) => `${file.fileName}: ${access}`))
    expect(violations).toEqual([])
  })
})
