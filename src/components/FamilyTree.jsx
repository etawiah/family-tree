import { useEffect, useRef } from "react";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";

const STORAGE_KEY = "family-tree-app-data";

const defaultData = [
  {
    id: "1",
    data: {
      gender: "M",
      "first name": "Eugene",
      "last name": "Tawiah",
      birthday: "1985",
      deathday: "",
      location: "Accra",
      profession: "Developer",
      notes: "Sample entry",
      photo: "",
    },
    rels: { parents: [], spouses: [], children: [] },
  },
];

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return defaultData;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export default function FamilyTree() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let data = loadData();
    const container = containerRef.current;
    container.innerHTML = "";

    const chart = f3.createChart(container, data)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setTransitionTime(1000)
      .setOrientationVertical();

    const card = chart
      .setCardHtml()
      .setCardDisplay([
        ["first name", "last name"],
        ["location"],
        ["birthday", "deathday"],
      ])
      .setCardImageField("photo");

    const editTree = chart
      .editTree()
      .setFields([
        "first name",
        "last name",
        "gender",
        "birthday",
        "deathday",
        "location",
        "profession",
        "notes",
        "photo",
      ])
      .setEditFirst(false)
      .setCardClickOpen(card)
      .setCanEdit(() => true)
      .setCanAdd(() => true)
      .setCanDelete(() => true)
      .setOnChange(() => {
        const updated = editTree.exportData();
        saveData(updated);
      });

    chart.updateTree({ initial: true });
    editTree.open(chart.getMainDatum());

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="f3"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "900px",
        display: "flex",
        background: "rgb(33, 33, 33)",
        color: "#fff",
      }}
    />
  );
}
