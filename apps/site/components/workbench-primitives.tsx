import { useEffect, useId, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";

type Variant = "default" | "secondary" | "outline" | "destructive" | "ghost";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function Button({
  className,
  variant = "default",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={joinClasses("button", `button-${variant}`, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={joinClasses("card", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={joinClasses("badge", `badge-${tone}`, className)} {...props} />;
}

export function Progress({
  value,
  className,
  ...props
}: ComponentProps<"div"> & { value: number }) {
  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className={joinClasses("progress", className)}
      role="progressbar"
      {...props}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={joinClasses("skeleton", className)} {...props} />;
}

export function Empty({
  title,
  description,
  children,
  className,
  ...props
}: ComponentProps<"div"> & { title: string; description: string; children?: ReactNode }) {
  return (
    <div className={joinClasses("empty", className)} {...props}>
      <div className="empty-icon" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={joinClasses("textarea", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={joinClasses("input", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={joinClasses("select", className)} {...props} />;
}

export function Sheet({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      openerRef.current?.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
    ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);

    if (focusableElements.length === 0) {
      event.preventDefault();
      sheetRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="sheet-backdrop">
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="sheet"
        onKeyDown={handleKeyDown}
        ref={sheetRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <Button aria-label="关闭" onClick={onClose} ref={closeButtonRef} type="button" variant="ghost">
            关闭
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function StatusToast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
