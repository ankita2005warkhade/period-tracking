import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Period Track",
  description: "Period Tracking App",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Navbar always visible */}
        <Navbar />

        {/* WRAPPER (adds only 1 padding for all pages) */}
        <div className="page-wrapper">
          {children}
        </div>
      </body>
    </html>
  );
}
