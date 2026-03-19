import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Expose Firestore utilities to window for script.js
window.auth = auth;
window.db = db;
window.doc = doc;
window.collection = collection;
window.addDoc = addDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.onSnapshot = onSnapshot;
window.query = query;
window.orderBy = orderBy;
window.serverTimestamp = serverTimestamp;

window.isLoggedIn = false;
window.isProfileComplete = false;

const authGate = document.getElementById("auth-gate");
const googleLoginBtn = document.getElementById("google-login");
const logoutBtn = document.getElementById("logoutBtn");

// Manual Auth Elements
const manualSignInBtn = document.getElementById("manual-signin");
const manualSignUpBtn = document.getElementById("manual-signup");

const provider = new GoogleAuthProvider();

// --- AUTH UTILITIES ---
window.showAuthGate = () => {
  if (authGate) authGate.classList.remove("hidden");
};

window.hideAuthGate = () => {
  if (authGate) authGate.classList.add("hidden");
};

// --- AUTH HANDLERS ---

// Google Login
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // For Google login, check if user exists in Firestore, if not create basic entry
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Login failed: " + error.message);
    }
  });
}

// Demo Login
const demoLoginBtn = document.getElementById("demo-login");
if (demoLoginBtn) {
  demoLoginBtn.addEventListener("click", async () => {
    const demoEmail = "demo@lifepurse.com";
    const demoPassword = "demo123";
    
    // Set flag in localStorage for UI updates
    localStorage.setItem("isDemoUser", "true");
    
    // Show a loading state on the button
    const originalText = demoLoginBtn.innerHTML;
    demoLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-purple-500 mr-2"></i> Logging in...';
    demoLoginBtn.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          // If demo account doesn't exist, create it and seed basic data
          const result = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          const user = result.user;
          await setDoc(doc(db, "users", user.uid), {
            displayName: "Demo User",
            email: demoEmail,
            age: "30",
            gender: "Female",
            bloodGroup: "O+",
            mobile: "9876543210",
            height: "165",
            weight: "60",
            profileCompleted: true,
            isDemo: true,
            createdAt: new Date().toISOString()
          });
        } catch (createError) {
          console.error("Failed to create demo account:", createError);
          alert("Demo login failed during setup.");
        }
      } else {
        console.error("Demo Login Error:", error);
        alert("Demo login failed: " + error.message);
      }
    } finally {
      // Reset button state
      demoLoginBtn.innerHTML = originalText;
      demoLoginBtn.disabled = false;
    }
  });
}

// Manual Sign Up
if (manualSignUpBtn) {
  manualSignUpBtn.addEventListener("click", async () => {
    const name = document.getElementById("signup-name").value;
    const age = document.getElementById("signup-age").value;
    const gender = document.getElementById("signup-gender").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    if (!name || !email || !password || !age) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = result.user;

      // Update Auth Profile
      await updateProfile(user, { displayName: name });

      // Store in Firestore
      await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        email: email,
        age: age,
        gender: gender,
        createdAt: new Date().toISOString(),
      });

      console.log("User registered and data stored in Firestore");
    } catch (error) {
      console.error("Sign Up Error:", error);
      alert("Registration failed: " + error.message);
    }
  });
}

// Manual Sign In
if (manualSignInBtn) {
  manualSignInBtn.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Sign In Error:", error);
      alert("Login failed: " + error.message);
    }
  });
}

// Handle Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      localStorage.clear(); // Clear all cached data
      window.location.href = "index.html";
    } catch (error) {
      console.error("Logout Error:", error);
    }
  });
}

window.firebaseLogout = async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Firebase Logout Error:", error);
  }
};

// --- STATE OBSERVER ---

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("User Logged In:", user.displayName);

    // Fetch user data from Firestore
    let userData = {
      displayName: user.displayName,
      email: user.email,
      profileCompleted: false,
    };

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        userData = { ...userData, ...userDoc.data() };
      }
    } catch (e) {
      console.error("Error fetching user data:", e);
    }

    // --- PROFILE COMPLETION GATE ---
    window.isLoggedIn = true;
    if (!userData.profileCompleted) {
      console.log("Profile incomplete, redirecting...");
      window.isProfileComplete = false;

      // Show only the complete-profile section
      window.hideAuthGate();
      if (typeof window.showSection === "function") {
        window.showSection("complete-profile", false);
      }

      // Pre-fill complete profile form
      const cpName = document.getElementById("cp-name");
      const cpEmail = document.getElementById("cp-email");
      if (cpName) cpName.value = userData.displayName || "";
      if (cpEmail) cpEmail.value = userData.email || "";

      // Hide main navigation buttons to prevent skipping
      const navButtons = document.querySelectorAll(
        ".nav-btn, #mobileBottomNav button",
      );
      navButtons.forEach((btn) => (btn.style.pointerEvents = "none"));
      const medicalBtn = document.querySelector(
        "button[onclick*=\"showSection('medassist')\"]",
      );
      if (medicalBtn) medicalBtn.style.opacity = "0.5";
    } else {
      // Profile is complete
      window.isProfileComplete = true;
      window.hideAuthGate();
      if (logoutBtn) logoutBtn.style.display = "flex";

      // Restore navigation
      const navButtons = document.querySelectorAll(
        ".nav-btn, #mobileBottomNav button",
      );
      navButtons.forEach((btn) => (btn.style.pointerEvents = "auto"));

      // If user was on complete-profile or home, send them to dashboard
      const currentHash = window.location.hash;
      if (
        currentHash === "#complete-profile" ||
        !currentHash ||
        currentHash === "#home"
      ) {
        if (typeof window.showSection === "function") {
          window.showSection("home");
        }
      }

      // Update Profile Views
      const authView = document.getElementById("authenticatedProfileView");
      if (authView) authView.style.display = "block";

      // Re-trigger showSection to apply logged-in route guards
      if (typeof window.showSection === "function") {
        const hash = window.location.hash.substring(1) || "home";
        window.showSection(hash, false);
      }

      if (typeof window.loadFamilyMembers === "function") {
        window.loadFamilyMembers();
      }
      if (typeof window.loadEmergencyContacts === "function") {
        window.loadEmergencyContacts();
      }
    }

    // --- Update LifePulse Profile UI (Dashboard & Sidebar) ---
    const profileNameDisp = document.getElementById("profileNameDisplay");
    const profileAgeGenderDisp = document.getElementById(
      "profileAgeGenderDisplay",
    );
    const profileImg = document.getElementById("profileImage");
    const profileIcon = document.getElementById("profileIcon");
    const navProfileImg = document.getElementById("navProfileImg");
    const navProfileIcon = document.getElementById("navProfileIcon");

    const finalName = userData.displayName || user.displayName || "User";
    const finalPhoto = userData.photoURL || user.photoURL;

    if (profileNameDisp) profileNameDisp.textContent = finalName;
    if (profileAgeGenderDisp) {
      const displayAge = userData.age ? `${userData.age} years` : "Add Age";
      const displayGender = userData.gender || "Add Gender";
      profileAgeGenderDisp.textContent = `${displayAge} • ${displayGender}`;
    }

    // --- Gender-Based UI (Pregnancy Care) ---
    const pregnancyCard = document.getElementById("pregnancyCard");
    const cpPregGroup = document.getElementById("cp-pregnancy-group");
    const editPregGroup = document.getElementById("editPregnancyGroup");
    const cpPregnantSelect = document.getElementById("cp-is-pregnant");
    const editPregnantSelect = document.getElementById("editIsPregnant");

    if (userData.gender === "Female") {
      if (cpPregGroup) cpPregGroup.classList.remove("hidden");
      if (editPregGroup) editPregGroup.classList.remove("hidden");

      const isPregnant = userData.isPregnant === true;
      if (cpPregnantSelect) cpPregnantSelect.value = isPregnant ? "Yes" : "No";
      if (editPregnantSelect) editPregnantSelect.value = isPregnant ? "Yes" : "No";

      if (pregnancyCard) {
        if (isPregnant) pregnancyCard.classList.remove("hidden");
        else pregnancyCard.classList.add("hidden");
      }
    } else {
      if (cpPregGroup) cpPregGroup.classList.add("hidden");
      if (editPregGroup) editPregGroup.classList.add("hidden");
      if (pregnancyCard) pregnancyCard.classList.add("hidden");
    }

    if (finalPhoto) {
      if (profileImg) {
        profileImg.src = finalPhoto;
        profileImg.classList.remove("hidden");
        if (profileIcon) profileIcon.classList.add("hidden");
      }
      if (navProfileImg) {
        navProfileImg.src = finalPhoto;
        navProfileImg.classList.remove("hidden");
        if (navProfileIcon) navProfileIcon.classList.add("hidden");
      }
    }

    // --- Sync with localStorage for script.js compatibility ---
    const localProfile = {
      name: finalName,
      age: userData.age || "",
      gender: userData.gender || "",
      isPregnant: userData.isPregnant || false,
      bloodGroup: userData.bloodGroup || "",
      phone: userData.mobile || "",
      email: userData.email || user.email || "",
    };
    localStorage.setItem("profileData", JSON.stringify(localProfile));

    const localMedical = {
      height: userData.height || "",
      weight: userData.weight || "",
      conditions: userData.conditions || "",
      allergies: userData.allergies || "",
      medications: userData.medications || "",
    };
    localStorage.setItem("medicalData", JSON.stringify(localMedical));

    // Now populate profile panel fields from fresh localStorage
    if (typeof window.loadProfileData === "function") {
      window.loadProfileData();
    }

    // --- Auto-fill Personal Information Menu ---
    const viewName = document.getElementById("viewName");
    const editName = document.getElementById("editName");
    const viewEmail = document.getElementById("viewEmail");
    const editEmail = document.getElementById("editEmail");
    const viewAge = document.getElementById("viewAge");
    const editAge = document.getElementById("editAge");
    const viewGender = document.getElementById("viewGender");
    const editGender = document.getElementById("editGender");
    const viewBloodGroup = document.getElementById("viewBloodGroup");
    const editBloodGroup = document.getElementById("editBloodGroup");
    const viewPhone = document.getElementById("viewPhone");
    const editPhone = document.getElementById("editPhone");
    const viewHeightWeight = document.getElementById("viewHeightWeight");
    const editHeight = document.getElementById("editHeight");
    const editWeight = document.getElementById("editWeight");

    if (viewName) viewName.textContent = finalName;
    if (editName) editName.value = finalName;
    if (viewEmail) viewEmail.textContent = userData.email || user.email || "";
    if (editEmail) editEmail.value = userData.email || user.email || "";

    // Always update — empty string is better than stale "Add data" HTML default
    if (viewAge) viewAge.textContent = userData.age || "";
    if (editAge) editAge.value = userData.age || "";
    if (viewGender) viewGender.textContent = userData.gender || "";
    if (editGender) editGender.value = userData.gender || "";
    if (viewBloodGroup) viewBloodGroup.textContent = userData.bloodGroup || "";
    if (editBloodGroup) editBloodGroup.value = userData.bloodGroup || "";
    if (viewPhone) viewPhone.textContent = userData.mobile || "";
    if (editPhone) editPhone.value = userData.mobile || "";

    if (viewHeightWeight) {
      const h = userData.height || "";
      const w = userData.weight || "";
      viewHeightWeight.textContent =
        h && w
          ? `${h} cm • ${w} kg`
          : h || w
            ? `${h || "--"} cm • ${w || "--"} kg`
            : "";
    }
    if (editHeight) editHeight.value = userData.height || "";
    if (editWeight) editWeight.value = userData.weight || "";

    // Medical view fields
    const viewConditions = document.getElementById("viewConditions");
    const viewAllergies = document.getElementById("viewAllergies");
    const viewMedications = document.getElementById("viewMedications");
    if (viewConditions) viewConditions.textContent = userData.conditions || "";
    if (viewAllergies) viewAllergies.textContent = userData.allergies || "";
    if (viewMedications)
      viewMedications.textContent = userData.medications || "";

    // Demo Mode Banner
    const isDemo = userData.email === "demo@lifepurse.com" || localStorage.getItem("isDemoUser") === "true";
    const demoBanner = document.getElementById("demo-banner");
    if (demoBanner) {
      if (isDemo) demoBanner.classList.remove("hidden");
      else demoBanner.classList.add("hidden");
    }
  } else {
    console.log("No User - Guest Mode");
    window.isLoggedIn = false;
    
    const demoBanner = document.getElementById("demo-banner");
    if (demoBanner) demoBanner.classList.add("hidden");
    window.isProfileComplete = false;
    window.hideAuthGate();
    if (logoutBtn) logoutBtn.style.display = "none";

    const authView = document.getElementById("authenticatedProfileView");
    if (authView) authView.style.display = "none";

    const profilePanel = document.getElementById("profilePanel");
    if (profilePanel) profilePanel.classList.add("translate-x-full");
    const profileOverlay = document.getElementById("profileOverlay");
    if (profileOverlay) profileOverlay.classList.add("hidden");

    // Hide Pregnancy Card for guests
    const pregnancyCard = document.getElementById("pregnancyCard");
    if (pregnancyCard) pregnancyCard.classList.add("hidden");

    // Re-trigger showSection to apply guest route guards
    if (typeof window.showSection === "function") {
      const hash = window.location.hash.substring(1) || "home";
      window.showSection(hash, false);
    }

    // Clear family members list on logout
    const familyList = document.getElementById("familyMembersList");
    if (familyList) {
      familyList.innerHTML = `
        <div class="text-center py-10 opacity-60">
            <i class="fas fa-lock text-4xl mb-3 block"></i>
            <p>Please login to view family members.</p>
        </div>`;
    }
  }
});

// Function to save profile completion data
window.saveProfileData = async (profileData) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");

  const { password, ...firestoreData } = profileData;

  // Update Password if provided (for future logins)
  if (password) {
    try {
      await updatePassword(user, password);
      console.log("User password updated successfully");
    } catch (e) {
      console.warn("Could not update password:", e.message);
      // Don't block profile save if password update fails (e.g. recent login required)
    }
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      ...firestoreData,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return true;
};
