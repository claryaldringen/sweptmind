package com.sweptmind.app;

import android.os.Bundle;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppInfoPlugin.class);
        super.onCreate(savedInstanceState);
        // Edge to edge on every Android version (Android 15+ enforces it from target SDK 35)
        EdgeToEdge.enable(this);
        keepContentClearOfSystemBars();
    }

    /**
     * The web app sets viewport-fit=cover but doesn't pad for safe areas, so the WebView is
     * inset natively instead: below the status bar, above the navigation bar and the keyboard.
     * Capacitor's own handling is off (SystemBars insetsHandling "disable" in capacitor.config.ts)
     * — with viewport-fit=cover it would draw the page under the bars on WebView 140+.
     */
    private void keepContentClearOfSystemBars() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, insets) -> {
            int barTypes = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets bars = insets.getInsets(barTypes);
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : bars.bottom;
            view.setPadding(bars.left, bars.top, bars.right, bottom);
            // Zero (not CONSUMED, which breaks later recalculation) so env(safe-area-inset-*)
            // stays 0 and the page doesn't pad a second time
            return new WindowInsetsCompat.Builder(insets).setInsets(barTypes, Insets.NONE).build();
        });
    }
}
