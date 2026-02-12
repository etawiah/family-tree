import FamilyTree from "./components/FamilyTree";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Family Tree</h1>
      </header>
      <main className="app-main">
        <FamilyTree />
      </main>
    </div>
  );
}

export default App;
