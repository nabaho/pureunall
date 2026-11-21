package kr.pureun.hanabridge;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputFilter;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

/* 「통화 후 명함 문자」 설정 화면 (2026-11-16).
   스위치를 «켤 때» 필요한 권한을 한꺼번에 묻는다 — 앱을 열 때 미리 묻지 않는다.
   고른 것은 «나갈 때·멈출 때» 자동 저장한다(저장 단추를 눌러야 하는 길은 잊혀서 설정이 사라진다). */
public final class CardSmsActivity extends Activity {
    private static final int ASK_PERMS = 4303;
    private Switch on;
    private RadioGroup savedGroup;
    private RadioGroup unknownGroup;
    private EditText body;
    private TextView status;
    private boolean loading;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setTitle("통화 후 명함 문자");
        setContentView(buildView());
        load();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override
    protected void onPause() {
        super.onPause();
        saveNow(false);
    }

    private View buildView() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(22), dp(18), dp(28));
        scroll.addView(root);

        TextView head = text("통화 후 명함 문자", 22, Color.rgb(15, 23, 42));
        head.setGravity(Gravity.START);
        root.addView(head, matchWrap());
        root.addView(text("통화가 끝나면 아래 명함 문구를 문자로 보냅니다. 모든 일은 이 폰 안에서만 일어나며, "
                + "번호·이름은 서버로 가지 않습니다.", 13, Color.rgb(71, 85, 105)), top(6));

        on = new Switch(this);
        on.setText("통화 끝나면 명함 문자 보내기");
        on.setTextSize(16);
        on.setOnCheckedChangeListener((v, checked) -> {
            if (loading) return;
            saveNow(false);
            if (checked) {
                String[] need = CardSms.missingPermissions(this);
                if (need.length > 0) requestPermissions(need, ASK_PERMS);
            }
            refreshStatus();
        });
        root.addView(on, top(18));

        root.addView(text("연락처에 저장된 번호", 15, Color.rgb(15, 23, 42)), top(18));
        savedGroup = modes();
        root.addView(savedGroup, matchWrap());

        root.addView(text("연락처에 없는 번호", 15, Color.rgb(15, 23, 42)), top(14));
        unknownGroup = modes();
        root.addView(unknownGroup, matchWrap());

        root.addView(text("보내는 명함 문구", 15, Color.rgb(15, 23, 42)), top(18));
        body = new EditText(this);
        body.setTextSize(16);        // 16 미만이면 폰이 입력칸을 확대한다
        body.setMinLines(6);
        body.setGravity(Gravity.TOP);
        body.setFilters(new InputFilter[]{new InputFilter.LengthFilter(CardSms.MAX_TEXT)});
        root.addView(body, matchWrap());

        Button reset = button("기본 문구로 되돌리기", Color.rgb(100, 116, 139));
        reset.setOnClickListener(v -> body.setText(CardSms.defaultText()));
        root.addView(reset, top(8));

        status = text("", 13, Color.rgb(71, 85, 105));
        status.setPadding(dp(12), dp(12), dp(12), dp(12));
        status.setBackgroundColor(Color.rgb(248, 250, 252));
        root.addView(status, top(18));

        root.addView(text("• 부재중·거절 통화, 3초 미만 통화, 휴대폰이 아닌 번호(유선·1588·번호 숨김)는 보내지 않습니다.\n"
                + "• 같은 번호에는 30일에 한 번만 보냅니다(보냈든, 안 보내기를 눌렀든).\n"
                + "• 연락처를 읽지 못하면 «저장된 번호»로 보고 물어봅니다.\n"
                + "• 문구가 길면 통신사가 여러 통으로 나눠 보냅니다.\n"
                + "• 폰의 절전·배터리 최적화가 앱을 재우면 통화 끝을 못 알아챌 수 있습니다.",
                12, Color.rgb(100, 116, 139)), top(14));
        return scroll;
    }

    private RadioGroup modes() {
        RadioGroup g = new RadioGroup(this);
        g.setOrientation(RadioGroup.VERTICAL);
        add(g, "보낼지 물어보기 (알림에서 누르면 발송)", CardSms.ASK);
        add(g, "바로 보내기", CardSms.AUTO);
        add(g, "보내지 않기", CardSms.OFF);
        g.setOnCheckedChangeListener((group, id) -> { if (!loading) saveNow(false); });
        return g;
    }

    private void add(RadioGroup g, String label, int mode) {
        RadioButton b = new RadioButton(this);
        b.setText(label);
        b.setTextSize(15);
        b.setTag(mode);
        b.setId(View.generateViewId());
        g.addView(b);
    }

    private void select(RadioGroup g, int mode) {
        for (int i = 0; i < g.getChildCount(); i++) {
            RadioButton b = (RadioButton) g.getChildAt(i);
            b.setChecked(((Integer) b.getTag()) == mode);
        }
    }

    private int picked(RadioGroup g, int dflt) {
        View b = g.findViewById(g.getCheckedRadioButtonId());
        return b == null ? dflt : (Integer) b.getTag();
    }

    private void load() {
        loading = true;
        on.setChecked(CardSms.isOn(this));
        select(savedGroup, CardSms.savedMode(this));
        select(unknownGroup, CardSms.unknownMode(this));
        body.setText(CardSms.text(this));
        loading = false;
    }

    private void saveNow(boolean toast) {
        if (loading || on == null) return;
        CardSms.save(this, on.isChecked(),
                picked(savedGroup, CardSms.ASK), picked(unknownGroup, CardSms.AUTO),
                body.getText().toString());
        if (toast) Toast.makeText(this, "저장했습니다.", Toast.LENGTH_SHORT).show();
    }

    private void refreshStatus() {
        if (status == null) return;
        String[] need = CardSms.missingPermissions(this);
        String perms = need.length == 0 ? "필요한 권한: 모두 허용됨"
                : "⚠ 아직 허용 안 된 권한이 " + need.length + "개 있습니다 — 스위치를 껐다 켜면 다시 묻습니다. "
                + "(거부를 거듭했다면 폰 설정 → 앱 → 권한에서 켜 주세요)";
        String last = CardSms.lastNote(this);
        status.setText(perms + "\n마지막 처리: " + (last.isEmpty() ? "아직 없음" : last));
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != ASK_PERMS) return;
        refreshStatus();
        if (CardSms.missingPermissions(this).length > 0) {
            Toast.makeText(this, "허용하지 않은 권한이 있어 일부 기능이 멈춥니다.", Toast.LENGTH_LONG).show();
        }
    }

    private TextView text(String value, int sp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.25f);
        return view;
    }

    private Button button(String value, int color) {
        Button view = new Button(this);
        view.setText(value);
        view.setTextSize(15);
        view.setTextColor(Color.WHITE);
        view.setBackgroundColor(color);
        view.setMinHeight(dp(50));
        return view;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams top(int dp) {
        LinearLayout.LayoutParams p = matchWrap();
        p.topMargin = dp(dp);
        return p;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
