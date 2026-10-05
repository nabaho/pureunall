/* 푸른 통합로그인 — 인증 앱(TOTP) 2단계 인증.
   기존 화면은 Firebase compat를 쓰므로, 이 작은 모듈만 최신 modular MFA API를 쓴다.
   같은 기본 앱 이름·API 키·저장소를 사용해 로그인 결과가 기존 compat 인증에도 이어진다. */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence,
  signInWithEmailAndPassword, getMultiFactorResolver, multiFactor,
  TotpMultiFactorGenerator, sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const cfg = {
  apiKey: 'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA',
  databaseURL: 'https://pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'pureun-erp',
  appId: '1:936817166182:web:9bd31f70d0afdf5fca2aa7',
  messagingSenderId: '936817166182'
};
const app = getApps()[0] || initializeApp(cfg);
const auth = getAuth(app);
let signResolver = null;
let enrollSecret = null;

function waitAuth(){ return auth.authStateReady ? auth.authStateReady() : Promise.resolve(); }
function cleanOtp(v){ return String(v || '').replace(/\D/g, '').slice(0, 6); }

window.PuMFA = {
  async beginLogin(email, password, keep){
    await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
    try {
      return { credential: await signInWithEmailAndPassword(auth, email, password) };
    } catch(err) {
      if(err && err.code === 'auth/multi-factor-auth-required') {
        signResolver = getMultiFactorResolver(auth, err);
        const hint = signResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if(!hint) throw new Error('등록된 인증 수단을 이 화면에서 사용할 수 없습니다.');
        return { mfa: true, label: hint.displayName || '푸른 인증 앱' };
      }
      throw err;
    }
  },
  async finishLogin(code){
    if(!signResolver) throw new Error('인증 요청이 만료되었습니다. 다시 로그인해 주세요.');
    const hint = signResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    const otp = cleanOtp(code);
    if(otp.length !== 6) throw new Error('인증 앱의 숫자 6자리를 입력해 주세요.');
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, otp);
    const cred = await signResolver.resolveSignIn(assertion);
    signResolver = null;
    return cred;
  },
  async status(){
    await waitAuth();
    const u = auth.currentUser;
    if(!u) return { signedIn:false, enrolled:false };
    const factors = multiFactor(u).enrolledFactors || [];
    return { signedIn:true, enrolled:factors.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID) };
  },
  async beginEnrollment(){
    await waitAuth();
    const u = auth.currentUser;
    if(!u) throw new Error('다시 로그인한 뒤 등록해 주세요.');
    if(!u.emailVerified) {
      await sendEmailVerification(u);
      throw new Error('계정 이메일로 인증 메일을 보냈습니다. 메일의 링크를 누른 뒤 다시 등록해 주세요.');
    }
    if((multiFactor(u).enrolledFactors || []).some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
      throw new Error('이미 인증 앱이 등록되어 있습니다.');
    }
    const session = await multiFactor(u).getSession();
    enrollSecret = await TotpMultiFactorGenerator.generateSecret(session);
    return {
      secretKey: enrollSecret.secretKey,
      uri: enrollSecret.generateQrCodeUrl(u.email || '', '푸른노무법인')
    };
  },
  async finishEnrollment(code){
    await waitAuth();
    const u = auth.currentUser, otp = cleanOtp(code);
    if(!u || !enrollSecret) throw new Error('등록 요청이 만료되었습니다. 처음부터 다시 해주세요.');
    if(otp.length !== 6) throw new Error('인증 앱의 숫자 6자리를 입력해 주세요.');
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(enrollSecret, otp);
    await multiFactor(u).enroll(assertion, '푸른 인증 앱');
    enrollSecret = null;
    return true;
  }
};
window.dispatchEvent(new Event('pu-mfa-ready'));
