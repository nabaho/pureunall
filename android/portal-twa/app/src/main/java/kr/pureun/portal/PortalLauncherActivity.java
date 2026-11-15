package kr.pureun.portal;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * 푸른포털 진입 액티비티.
 * - 온라인 상태에서는 즉시 Trusted Web Activity(LauncherActivity)로 연결한다.
 * - 비행기 모드·통신 단절 등 오프라인 상태에서는 브라우저 원시 오류 화면 대신
 *   한국어 안내 화면과 재시도·네트워크 설정 이동을 제공하고, 연결 복구 즉시 자동으로 포털을 연다.
 */
public class PortalLauncherActivity extends Activity {

    private boolean launched = false;
    private ConnectivityManager.NetworkCallback networkCallback = null;
    private TextView statusHintView = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (isOnline()) {
            openTwaAndFinish();
            return;
        }
        renderOfflineScreen();
        registerNetworkWatcher();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!launched && isOnline()) {
            openTwaAndFinish();
        }
    }

    @Override
    protected void onDestroy() {
        unregisterNetworkWatcher();
        super.onDestroy();
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network active = cm.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(active);
        if (caps == null) return false;
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private boolean isAllowedPortalUri(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();
        String allowedHost = getString(R.string.host_name);
        if (!"https".equalsIgnoreCase(scheme)) return false;
        if (host == null || !allowedHost.equalsIgnoreCase(host)) return false;
        return path != null && (path.equals("/pureunall") || path.startsWith("/pureunall/"));
    }

    private void openTwaAndFinish() {
        if (launched) return;
        launched = true;
        unregisterNetworkWatcher();
        Intent intent = new Intent(this, LauncherActivity.class);
        Intent incoming = getIntent();
        if (incoming != null && Intent.ACTION_VIEW.equals(incoming.getAction())) {
            Uri data = incoming.getData();
            if (isAllowedPortalUri(data)) {
                intent.setAction(Intent.ACTION_VIEW);
                intent.setData(data);
            }
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        finish();
    }

    private void registerNetworkWatcher() {
        if (networkCallback != null) return;
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (isOnline()) {
                            openTwaAndFinish();
                        }
                    }
                });
            }
        };
        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (RuntimeException ignored) {
            networkCallback = null;
        }
    }

    private void unregisterNetworkWatcher() {
        if (networkCallback == null) return;
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                // 이미 해제된 경우 무시
            }
        }
        networkCallback = null;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()
        ));
    }

    @SuppressWarnings("deprecation")
    private void applyEdgeToEdgePadding(final View target) {
        target.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int left = insets.getSystemWindowInsetLeft();
                int top = insets.getSystemWindowInsetTop();
                int right = insets.getSystemWindowInsetRight();
                int bottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Insets sys = insets.getInsets(WindowInsets.Type.systemBars());
                    left = sys.left;
                    top = sys.top;
                    right = sys.right;
                    bottom = sys.bottom;
                }
                v.setPadding(dp(24) + left, dp(24) + top, dp(24) + right, dp(24) + bottom);
                return insets;
            }
        });
    }

    private void renderOfflineScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.parseColor("#1E293B"));

        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setGravity(Gravity.CENTER);
        outer.setPadding(dp(24), dp(24), dp(24), dp(24));
        applyEdgeToEdgePadding(outer);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(28), dp(32), dp(28), dp(28));
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#FFFFFF"));
        cardBg.setCornerRadius(dp(20));
        card.setBackground(cardBg);

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        card.setLayoutParams(cardParams);

        TextView badge = new TextView(this);
        badge.setText("푸");
        badge.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        GradientDrawable badgeBg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.parseColor("#1E3A8A"), Color.parseColor("#2563EB")}
        );
        badgeBg.setCornerRadius(dp(18));
        badge.setBackground(badgeBg);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(68), dp(68));
        badgeParams.bottomMargin = dp(18);
        badge.setLayoutParams(badgeParams);
        card.addView(badge);

        TextView title = new TextView(this);
        title.setText(R.string.offline_title);
        title.setTextColor(Color.parseColor("#1E293B"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title);

        TextView desc = new TextView(this);
        desc.setText(R.string.offline_message);
        desc.setTextColor(Color.parseColor("#475569"));
        desc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        desc.setGravity(Gravity.CENTER);
        desc.setLineSpacing(0f, 1.35f);
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        descParams.topMargin = dp(10);
        descParams.bottomMargin = dp(22);
        desc.setLayoutParams(descParams);
        card.addView(desc);

        Button retryBtn = new Button(this);
        retryBtn.setText(R.string.offline_retry);
        retryBtn.setAllCaps(false);
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        retryBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable retryBg = new GradientDrawable();
        retryBg.setColor(Color.parseColor("#2563EB"));
        retryBg.setCornerRadius(dp(12));
        retryBtn.setBackground(retryBg);
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
        );
        retryBtn.setLayoutParams(retryParams);
        retryBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isOnline()) {
                    openTwaAndFinish();
                } else if (statusHintView != null) {
                    statusHintView.setText(R.string.offline_still_disconnected);
                    statusHintView.setVisibility(View.VISIBLE);
                }
            }
        });
        card.addView(retryBtn);

        Button settingsBtn = new Button(this);
        settingsBtn.setText(R.string.offline_open_settings);
        settingsBtn.setAllCaps(false);
        settingsBtn.setTextColor(Color.parseColor("#1E40AF"));
        settingsBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        GradientDrawable settingsBg = new GradientDrawable();
        settingsBg.setColor(Color.parseColor("#EFF6FF"));
        settingsBg.setStroke(dp(1), Color.parseColor("#BFDBFE"));
        settingsBg.setCornerRadius(dp(12));
        settingsBtn.setBackground(settingsBg);
        LinearLayout.LayoutParams settingsParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(46)
        );
        settingsParams.topMargin = dp(10);
        settingsBtn.setLayoutParams(settingsParams);
        settingsBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS));
                } catch (RuntimeException fallback) {
                    startActivity(new Intent(Settings.ACTION_SETTINGS));
                }
            }
        });
        card.addView(settingsBtn);

        statusHintView = new TextView(this);
        statusHintView.setTextColor(Color.parseColor("#DC2626"));
        statusHintView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        statusHintView.setGravity(Gravity.CENTER);
        statusHintView.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        statusHintView.setVisibility(View.GONE);
        LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        hintParams.topMargin = dp(12);
        statusHintView.setLayoutParams(hintParams);
        card.addView(statusHintView);

        outer.addView(card);
        scroll.addView(outer);
        setContentView(scroll);
    }
}
