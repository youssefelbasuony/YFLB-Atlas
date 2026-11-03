import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const EDITORS = new Set(["youssefelbasuony1@gmail.com", "yflb.business1@gmail.com"]);
const COLLECTION = "atlasRoadmaps";
const USER_STATE_COLLECTION = "userLearning";

export async function createContentStore(config) {
  const configured = Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
  if (!configured) {
    return {
      configured: false,
      user: null,
      isEditor: () => false,
      subscribeUser: () => () => {},
      load: async () => {},
      loadUserState: async () => null,
      saveUserState: async () => { throw new Error("Sign-in sync is not configured yet."); },
      signIn: async () => {},
      signOut: async () => {},
      save: async () => { throw new Error("The content editor is not connected yet."); },
      remove: async () => { throw new Error("The content editor is not connected yet."); }
    };
  }

  const app = getApps().find((item) => item.name === "atlas-content") || initializeApp(config, "atlas-content");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  let currentUser = null;
  let redirectError = null;
  let signInRequest = null;

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) currentUser = result.user;
  } catch (error) {
    redirectError = error;
  }

  const isEditor = (user = currentUser) => Boolean(
    user?.emailVerified && EDITORS.has((user.email || "").toLowerCase())
  );

  return {
    configured: true,
    get user() { return currentUser; },
    get redirectError() { return redirectError; },
    isEditor,
    subscribeUser(callback) {
      return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
      });
    },
    async load(roadmaps) {
      const snapshot = await getDocs(collection(db, COLLECTION));
      const index = new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap]));
      for (const entry of snapshot.docs) {
        const value = entry.data();
        if (value.deleted === true) {
          index.delete(entry.id);
        } else if (value.payload && typeof value.payload === "object") {
          index.set(entry.id, value.payload);
        }
      }
      roadmaps.splice(0, roadmaps.length, ...index.values());
    },
    async loadUserState(userId) {
      if (!currentUser || currentUser.uid !== userId) throw new Error("Sign in to load your learning data.");
      const snapshot = await getDoc(doc(db, USER_STATE_COLLECTION, userId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async saveUserState(userId, state) {
      if (!currentUser || currentUser.uid !== userId) throw new Error("Sign in to save your learning data.");
      const personalState = {
        favorites: Array.isArray(state.favorites) ? state.favorites : [],
        started: Array.isArray(state.started) ? state.started : [],
        progress: state.progress && typeof state.progress === "object" ? state.progress : {},
        learning: state.learning && typeof state.learning === "object" ? state.learning : {},
        skipped: state.skipped && typeof state.skipped === "object" ? state.skipped : {},
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, USER_STATE_COLLECTION, userId), personalState);
    },
    signIn() {
      if (signInRequest) return signInRequest;
      if (matchMedia("(pointer: coarse)").matches) {
        signInRequest = signInWithRedirect(auth, provider);
        signInRequest.catch(() => { signInRequest = null; });
        return signInRequest;
      }
      signInRequest = signInWithPopup(auth, provider);
      return signInRequest.finally(() => { signInRequest = null; });
    },
    async signOut() { return signOut(auth); },
    async save(roadmap) {
      if (!isEditor()) throw new Error("This Google account does not have content-editing access.");
      await setDoc(doc(db, COLLECTION, roadmap.id), { payload: roadmap, deleted: false, updatedAt: serverTimestamp() });
    },
    async remove(roadmapId) {
      if (!isEditor()) throw new Error("This Google account does not have content-editing access.");
      await setDoc(doc(db, COLLECTION, roadmapId), { deleted: true, updatedAt: serverTimestamp() });
    }
  };
}

export { EDITORS };
