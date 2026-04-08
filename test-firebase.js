import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDLafTH1VCWlGejJVoYZCwoWVlTV-rwzWY",
    authDomain: "lifepulse-5ab20.firebaseapp.com",
    projectId: "lifepulse-5ab20",
    storageBucket: "lifepulse-5ab20.appspot.com",
    messagingSenderId: "944160711421",
    appId: "1:944160711421:web:bf5494655d6e65ee351494"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
    try {
        await signInWithEmailAndPassword(auth, "demo@lifepurse.com", "demo123");
        console.log("SIGNED IN");
    } catch(e) {
        console.log("SIGN IN ERROR:", e.code);
        try {
            await createUserWithEmailAndPassword(auth, "demo@lifepurse.com", "demo123");
            console.log("CREATED");
        } catch(e2) {
            console.log("CREATE ERROR:", e2.code);
        }
    }
    process.exit(0);
}
test();
