package com.sweptmind.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Capabilities of this native build that the web app can't detect on its own. */
@CapacitorPlugin(name = "AppInfo")
public class AppInfoPlugin extends Plugin {

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        // The google-services Gradle plugin generates google_app_id only when google-services.json
        // is present. Without it FirebaseMessaging throws and push registration crashes the app.
        int googleAppId = getContext()
            .getResources()
            .getIdentifier("google_app_id", "string", getContext().getPackageName());

        JSObject result = new JSObject();
        result.put("pushConfigured", googleAppId != 0);
        call.resolve(result);
    }
}
