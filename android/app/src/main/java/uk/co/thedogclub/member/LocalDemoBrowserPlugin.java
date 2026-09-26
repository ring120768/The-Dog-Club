package uk.co.thedogclub.member;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Set;

@CapacitorPlugin(name = "LocalDemoBrowser")
public class LocalDemoBrowserPlugin extends Plugin {
    private static final Set<String> LOCAL_HOSTS = Set.of(
        "localhost",
        "127.0.0.1",
        "10.0.2.2"
    );

    @PluginMethod
    public void open(PluginCall call) {
        boolean isDebuggable =
            (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!isDebuggable) {
            call.reject("Local demo browsing is unavailable in release builds.");
            return;
        }

        String value = call.getString("url");
        Uri url = value == null ? null : Uri.parse(value);
        if (
            url == null ||
            !"http".equals(url.getScheme()) ||
            !LOCAL_HOSTS.contains(url.getHost())
        ) {
            call.reject("Only recognised local HTTP demo URLs may be opened.");
            return;
        }

        Intent intent = new Intent(getActivity(), LocalDemoBrowserActivity.class);
        intent.putExtra(LocalDemoBrowserActivity.EXTRA_URL, url.toString());
        getActivity().startActivity(intent);
        call.resolve();
    }
}
