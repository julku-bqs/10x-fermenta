import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center rounded-full p-1.5 transition-colors"
        aria-label="User menu"
      >
        <User className="size-4" />
      </button>

      {open && (
        <div className="border-border bg-card absolute right-0 z-50 mt-2 w-56 rounded-lg border p-2 shadow-lg">
          <p className="text-muted-foreground truncate px-3 py-2 text-sm">{email}</p>
          <hr className="border-border my-1" />
          <form method="POST" action="/api/auth/signout">
            <button
              type="submit"
              className="text-foreground hover:bg-muted w-full rounded-md px-3 py-2 text-left text-sm transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
