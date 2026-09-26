package uk.co.thedogclub.member;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalDemoBrowserPlugin.class);
        registerPlugin(SessionVaultPlugin.class);
        super.onCreate(savedInstanceState);

        // The labelled local demo may call the host machine through 10.0.2.2.
        // Keep mixed HTTP content disabled in release builds.
        boolean isDebuggable =
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (isDebuggable) {
            bridge.getWebView()
                .getSettings()
                .setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
