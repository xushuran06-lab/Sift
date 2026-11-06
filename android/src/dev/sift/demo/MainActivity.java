package dev.sift.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

/** Offline, permission-free host for the existing Sift demo. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME_URL = ORIGIN + "/assets/index.html";
    private static final int PICK_IMAGE = 101, EXPORT_DOCUMENT = 102;
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList(
        "index.html", "style.css", "redesign.css", "core.js", "content-core.js",
        "scope-core.js", "workflow-core.js", "workflow.js", "workflow.css", "app.js", "brain.js", "minimal.js", "focus.js", "android.js"));
    private WebView web;
    private WebMessagePort nativePort;
    private ValueCallback<Uri[]> imageCallback;
    private byte[] pendingExport;
    private String pendingShare;
    private boolean ready;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16,17,21));
        getWindow().setNavigationBarColor(Color.rgb(30,34,43));
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16,17,21));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom,keyboard.bottom));
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16,17,21));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        // Only user-selected content URIs from the system picker; no storage permission.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!"GET".equals(request.getMethod()) || !isLocal(uri) || path == null || !path.startsWith("/assets/")) return blocked();
                String filename = path.substring(8);
                if (!ASSETS.contains(filename)) return blocked();
                try {
                    String mime = filename.endsWith(".html") ? "text/html" : filename.endsWith(".css") ? "text/css" : "application/javascript";
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
                    return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("www/"+filename));
                } catch(IOException e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isLocal(request.getUrl()) && "/assets/index.html".equals(request.getUrl().getPath())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!HOME_URL.equals(url)) return;
                if (nativePort != null) nativePort.close();
                WebMessagePort[] ports = web.createWebMessageChannel();
                nativePort = ports[0];
                nativePort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                    @Override public void onMessage(WebMessagePort port, WebMessage message) {
                        if (!isLocal(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                        handleMessage(message.getData());
                    }
                });
                web.postWebMessage(new WebMessage("sift-native", new WebMessagePort[]{ports[1]}),Uri.parse(ORIGIN));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (imageCallback != null) imageCallback.onReceiveValue(null);
                imageCallback = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("image/*");
                picker.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp","image/gif"});
                try { startActivityForResult(picker,PICK_IMAGE); }
                catch(ActivityNotFoundException e) { imageCallback.onReceiveValue(null);imageCallback=null;notifyUser("没有可用的图片选择器"); }
                return true;
            }
        });
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        root.requestApplyInsets();
        readShare(getIntent());
        web.loadUrl(HOME_URL);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
    }
    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null;
    }
    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",new HashMap<>(),new ByteArrayInputStream(new byte[0]));
    }
    private void handleMessage(String text) {
        try {
            if (text == null || text.length() > 8*1024*1024) return;
            JSONObject data = new JSONObject(text);
            String action = data.optString("action");
            if ("ready".equals(action)) { ready=true;deliverShare(); }
            else if ("openUrl".equals(action)) openExternal(Uri.parse(data.optString("url")));
            else if ("export".equals(action)) {
                if (pendingExport != null) { notifyUser("请先完成上一次导出"); return; }
                String mime = data.optString("mime");
                if (!"application/json".equals(mime) && !"text/markdown".equals(mime) && !"text/calendar".equals(mime)) return;
                String name = data.optString("name").replaceAll("[^\\p{L}\\p{N}._ -]","_");
                if (name.isEmpty() || name.length()>128) return;
                pendingExport = data.optString("content").getBytes(StandardCharsets.UTF_8);
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType(mime);save.putExtra(Intent.EXTRA_TITLE,name);
                try { startActivityForResult(save,EXPORT_DOCUMENT); }
                catch(ActivityNotFoundException e) { pendingExport=null;notifyUser("没有可用的文件保存器"); }
            }
        } catch(Exception e) { notifyUser("无法处理这次操作，请重试"); }
    }
    private void openExternal(Uri uri) {
        if (!("https".equals(uri.getScheme())||"http".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch(ActivityNotFoundException e) { notifyUser("没有可用的浏览器"); }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==PICK_IMAGE && imageCallback!=null) {
            Uri uri = result==RESULT_OK && data!=null ? data.getData() : null;
            if (uri != null && !"content".equals(uri.getScheme())) uri=null;
            imageCallback.onReceiveValue(uri==null ? null : new Uri[]{uri});imageCallback=null;
        }
        if(request==EXPORT_DOCUMENT && pendingExport!=null) {
            byte[] bytes=pendingExport;pendingExport=null;
            if(result!=RESULT_OK || data==null || data.getData()==null) { notifyUser("已取消导出");return; }
            Uri destination=data.getData();
            if(!"content".equals(destination.getScheme())) { notifyUser("无法写入所选位置");return; }
            // A large JSON export must not block the UI thread.
            new Thread(() -> {
                try(OutputStream out=getContentResolver().openOutputStream(destination,"w")) {
                    if(out==null)throw new IOException("No stream");out.write(bytes);
                    runOnUiThread(()->notifyUser("文件已保存"));
                }catch(IOException|SecurityException e){runOnUiThread(()->notifyUser("导出失败，请选择其他位置重试"));}
            },"sift-export").start();
        }
    }
    private void readShare(Intent intent) {
        if(intent!=null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            CharSequence value=intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if(value!=null)pendingShare=value.subSequence(0,Math.min(value.length(),4000)).toString();
        }
    }
    private void deliverShare() {
        if(!ready || pendingShare==null)return;
        String text=pendingShare;pendingShare=null;
        try { nativePort.postMessage(new WebMessage(new JSONObject().put("type","shared-text").put("text",text).toString())); }
        catch(Exception e){notifyUser("分享内容导入失败，请重新粘贴");}
    }
    @Override protected void onNewIntent(Intent intent) {super.onNewIntent(intent);setIntent(intent);readShare(intent);deliverShare();}
    private void handleBack() {
        web.evaluateJavascript("window.siftAndroidBack ? window.siftAndroidBack() : false",result->{if(!"true".equals(result))finish();});
    }
    @Override public void onBackPressed(){handleBack();}
    private void notifyUser(String text){Toast.makeText(this,text,Toast.LENGTH_SHORT).show();}
    @Override protected void onPause(){web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(imageCallback!=null)imageCallback.onReceiveValue(null);if(nativePort!=null)nativePort.close();if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
