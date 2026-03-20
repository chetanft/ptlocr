import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { rem14 } from "@/lib/rem";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-700" style={{ marginBottom: rem14(16) }}>404</h1>
        <p className="text-primary-300" style={{ marginBottom: rem14(16), fontSize: rem14(20) }}>Oops! Page not found</p>
        <a href="/" className="text-neutral underline hover:text-neutral-dark">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
