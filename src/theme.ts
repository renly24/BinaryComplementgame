"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#7b1fa2" },
    background: { default: "#f0f4f8" },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
  },
  shape: { borderRadius: 12 },
});

export default theme;
