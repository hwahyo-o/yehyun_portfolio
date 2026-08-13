import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const config = window.PORTFOLIO_CONFIG?.firebase;
const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
let client = null;

if (config && required.every((key) => typeof config[key] === 'string' && config[key])) {
  const auth = getAuth(initializeApp(config));
  await setPersistence(auth, browserSessionPersistence);
  client = {
    async emailLogin(email, password) {
      return signInWithEmailAndPassword(auth, email, password);
    },
    async googleLogin() {
      return signInWithPopup(auth, new GoogleAuthProvider());
    },
    async linkGoogle(email, password) {
      const user = auth.currentUser;
      if (!user || user.email !== email) throw new Error('현재 로그인한 관리자 이메일과 일치하지 않습니다.');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
      return linkWithPopup(user, new GoogleAuthProvider());
    },
    async token() {
      return auth.currentUser ? auth.currentUser.getIdToken() : '';
    },
    async logout() {
      return signOut(auth);
    },
    observe(listener) {
      return onAuthStateChanged(auth, listener);
    },
  };
}

window.portfolioFirebaseReady = Promise.resolve(client);
