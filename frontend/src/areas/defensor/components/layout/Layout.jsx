import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export const Layout = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300">
        <Header />
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
