# THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!!

# Copyright 2020-2023 Tauri Programme within The Commons Conservancy
# SPDX-License-Identifier: Apache-2.0
# SPDX-License-Identifier: MIT

-keep class com.lumaread.reader.* {
  native <methods>;
}

-keep class com.lumaread.reader.WryActivity {
  public <init>(...);

  void setWebView(com.lumaread.reader.RustWebView);
  java.lang.Class getAppClass(...);
  java.lang.String getVersion();
}

-keep class com.lumaread.reader.Ipc {
  public <init>(...);

  @android.webkit.JavascriptInterface public <methods>;
}

-keep class com.lumaread.reader.RustWebView {
  public <init>(...);

  void loadUrlMainThread(...);
  void loadHTMLMainThread(...);
  void evalScript(...);
}

-keep class com.lumaread.reader.RustWebChromeClient,com.lumaread.reader.RustWebViewClient {
  public <init>(...);
}
