declare module 'mammoth/mammoth.browser.js' {
  interface MammothResult { value: string; messages: Array<{ type: string; message: string }> }
  interface Mammoth {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string[]; convertImage?: unknown }): Promise<MammothResult>
    images: { imgElement(converter: () => Promise<{ src: string }>): unknown }
  }
  const mammoth: Mammoth
  export default mammoth
}
