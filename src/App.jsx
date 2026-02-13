import FamilyTree from "./components/FamilyTree";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo-fist.png" alt="" className="app-header-logo" />
        <h1>Family Tree (Tawiah – Ocansey)</h1>
        <a href="/auth/logout" className="app-header-signout">Sign out</a>
      </header>
      <main className="app-main">
        <FamilyTree />
      </main>
    </div>
  );
}

export default App;
