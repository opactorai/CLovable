"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [tab, setTab] = useState("home");
  const [ingredients, setIngredients] = useState("");
  const [recipes, setRecipes] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fade, setFade] = useState(true);

  // ✅ localStorage 불러오기
  useEffect(() => {
    const stored = localStorage.getItem("savedRecipes");
    if (stored) {
      setSaved(JSON.parse(stored));
    }
  }, []);

  // ✅ 탭 전환 애니메이션
  const changeTab = (newTab: string) => {
    setFade(false);
    setTimeout(() => {
      setTab(newTab);
      setFade(true);
    }, 150);
  };

  const getRecipe = async () => {
    if (!ingredients) return;

    setLoading(true);
    setRecipes("");

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });

      const data = await res.json();
      setRecipes(data.recipes);
    } catch {
      setRecipes("에러가 발생했습니다.");
    }

    setLoading(false);
  };

  const saveRecipe = () => {
    if (!recipes) return;

    const updated = [...saved, recipes];
    setSaved(updated);
    localStorage.setItem("savedRecipes", JSON.stringify(updated));
  };

  // ✅ 삭제 기능
  const deleteRecipe = (index: number) => {
    const updated = saved.filter((_, i) => i !== index);
    setSaved(updated);
    localStorage.setItem("savedRecipes", JSON.stringify(updated));
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.phone}>
        <div
          style={{
            ...styles.content,
            opacity: fade ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
          }}
        >
          {tab === "home" && (
            <>
              <h1 style={styles.title}>🍳 AI 레시피</h1>

              <input
                type="text"
                placeholder="예: 계란, 양파, 치즈"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                style={styles.input}
              />

              <button onClick={getRecipe} style={styles.button}>
                {loading ? "추천 중..." : "레시피 추천받기"}
              </button>

              {recipes && (
                <div style={styles.card}>
                  <pre style={styles.result}>{recipes}</pre>
                  <button onClick={saveRecipe} style={styles.saveBtn}>
                    ⭐ 저장하기
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "saved" && (
            <>
              <h1 style={styles.title}>⭐ 저장된 레시피</h1>

              {saved.length === 0 ? (
                <p>저장된 레시피가 없습니다.</p>
              ) : (
                saved.map((item, index) => (
                  <div key={index} style={styles.card}>
                    <pre style={styles.result}>{item}</pre>
                    <button
                      onClick={() => deleteRecipe(index)}
                      style={styles.deleteBtn}
                    >
                      🗑 삭제
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "settings" && (
            <>
              <h1 style={styles.title}>⚙ 설정</h1>
              <p>AI 레시피 앱 v1.2</p>
              <p>데이터는 브라우저에 저장됩니다.</p>
            </>
          )}
        </div>

        {/* 하단 탭 바 */}
        <div style={styles.tabBar}>
          <div
            style={tab === "home" ? styles.activeTab : styles.tab}
            onClick={() => changeTab("home")}
          >
            🏠 홈
          </div>
          <div
            style={tab === "saved" ? styles.activeTab : styles.tab}
            onClick={() => changeTab("saved")}
          >
            ⭐ 저장
          </div>
          <div
            style={tab === "settings" ? styles.activeTab : styles.tab}
            onClick={() => changeTab("settings")}
          >
            ⚙ 설정
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    minHeight: "100vh",
    background: "#f4f6f8",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  phone: {
    width: "360px",
    height: "640px",
    background: "#ffffff",
    borderRadius: "30px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
  },
  title: {
    textAlign: "center",
    marginBottom: "20px",
  },
  input: {
    padding: "14px",
    borderRadius: "15px",
    border: "1px solid #ddd",
    fontSize: "14px",
    marginBottom: "15px",
    width: "100%",
  },
  button: {
    padding: "14px",
    borderRadius: "15px",
    border: "none",
    background: "#0070f3",
    color: "white",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    marginBottom: "20px",
  },
  saveBtn: {
    marginTop: "10px",
    padding: "8px",
    borderRadius: "10px",
    border: "none",
    background: "#ffb703",
    cursor: "pointer",
  },
  deleteBtn: {
    marginTop: "10px",
    padding: "6px",
    borderRadius: "8px",
    border: "none",
    background: "#ef4444",
    color: "white",
    cursor: "pointer",
  },
  card: {
    background: "#f9fafb",
    borderRadius: "20px",
    padding: "15px",
    marginBottom: "15px",
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
    whiteSpace: "pre-wrap",
  },
  result: {
    fontFamily: "inherit",
    fontSize: "14px",
  },
  tabBar: {
    height: "60px",
    borderTop: "1px solid #eee",
    display: "flex",
  },
  tab: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    color: "#666",
    fontSize: "14px",
  },
  activeTab: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#0070f3",
    borderTop: "3px solid #0070f3",
  },
};
