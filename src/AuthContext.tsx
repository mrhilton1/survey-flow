import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  login: (method?: 'popup' | 'redirect') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    console.log("AuthProvider: Initializing...");
    
    // Set persistence to local
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("AuthProvider: Persistence error:", err);
    });

    // Handle redirect result
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("AuthProvider: Redirect result success:", result.user.email);
        }
      })
      .catch((error) => {
        console.error("AuthProvider: Redirect result error:", error);
        setAuthError(`Redirect error: ${error.message}`);
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("AuthProvider: onAuthStateChanged fired. User:", currentUser ? currentUser.email : "null");
      
      try {
        if (currentUser) {
          setUser(currentUser);
          
          // Check/Create user profile
          console.log("AuthProvider: Fetching user profile for", currentUser.uid);
          const userRef = doc(db, 'users', currentUser.uid);
          
          try {
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
              console.log("AuthProvider: Creating new user profile...");
              const newUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                role: currentUser.email === 'mikehilton.work@gmail.com' ? 'admin' : 'user',
                createdAt: Date.now()
              };
              await setDoc(userRef, newUser);
              setIsAdmin(newUser.role === 'admin');
              console.log("AuthProvider: New profile created. Admin:", newUser.role === 'admin');
            } else {
              const data = userSnap.data();
              console.log("AuthProvider: Existing profile found:", data);
              setIsAdmin(data?.role === 'admin');
            }
          } catch (firestoreErr: any) {
            console.error("AuthProvider: Firestore error fetching profile:", firestoreErr);
            // If firestore fails, we still have the auth user, so let them in
            // but log the error
            setAuthError(`Profile sync error: ${firestoreErr.message}`);
            // Fallback admin check based on email if firestore fails
            setIsAdmin(currentUser.email === 'mikehilton.work@gmail.com');
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error: any) {
        console.error("AuthProvider: General auth initialization error:", error);
        setAuthError(error.message || "Failed to initialize user profile");
      } finally {
        console.log("AuthProvider: Initialization complete. Loading set to false.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (method: 'popup' | 'redirect' = 'popup') => {
    console.log(`AuthProvider: Login initiated with method: ${method}`);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameters to force account selection if needed
      provider.setCustomParameters({ prompt: 'select_account' });

      if (method === 'popup') {
        console.log("AuthProvider: Attempting signInWithPopup...");
        const result = await signInWithPopup(auth, provider);
        console.log("AuthProvider: signInWithPopup success:", result.user.email);
      } else {
        console.log("AuthProvider: Attempting signInWithRedirect...");
        await signInWithRedirect(auth, provider);
      }
    } catch (error: any) {
      console.error("AuthProvider: Login error:", error);
      setAuthError(error.message || "Login failed");
      throw error;
    }
  };

  const logout = async () => {
    console.log("AuthProvider: Logout initiated");
    try {
      await signOut(auth);
      console.log("AuthProvider: Logout success");
    } catch (error: any) {
      console.error("AuthProvider: Logout error:", error);
      setAuthError(error.message || "Logout failed");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, authError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
