"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Users, Plus, X, Shield, Link2, Check, KeyRound, Copy } from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import type { User, UserStatus } from "@/types";
import { InstanceSettingsTab } from "@/components/settings/instance-settings-tab";
import { BrandingTab } from "@/components/settings/branding-tab";

function BulkInviteDialog() {
  const t = useTranslations("settings.admin.bulkInvite");
  const tErrors = useTranslations("errors");
  const [open, setOpen] = React.useState(false);
  const [emails, setEmails] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailList = emails
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emailList.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    let sent = 0;
    const skipped: string[] = [];
    const failed: string[] = [];
    try {
      for (const email of emailList) {
        try {
          const name = email.split("@")[0];
          await api.post("/users/invite", { email, name });
          sent++;
        } catch (err: unknown) {
          if (err instanceof ApiError && err.code === "email_already_registered") {
            skipped.push(email);
          } else {
            failed.push(email);
          }
        }
      }
      const parts: string[] = [];
      if (sent > 0) parts.push(t("sentCount", { count: sent }));
      if (skipped.length > 0)
        parts.push(t("alreadyRegisteredCount", { count: skipped.length }));
      if (failed.length > 0) parts.push(t("failedCount", { count: failed.length }));
      if (sent > 0 || skipped.length > 0) {
        setSuccess(parts.join(", "));
        if (failed.length === 0) {
          setEmails("");
          setTimeout(() => setOpen(false), 1500);
        }
      }
      if (failed.length > 0) {
        setError(t("failedToInvite", { emails: failed.join(", ") }));
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? translateApiError(err, tErrors) : t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Users className="h-4 w-4" />
          {t("trigger")}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="glass-panel fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Close className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </Dialog.Close>

          <Dialog.Title className="text-base font-semibold text-text-primary">
            {t("title")}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {t("description")}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                {t("emailsLabel")}
              </label>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="user1@example.com&#10;user2@example.com"
                rows={5}
                className="flex w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus resize-none"
              />
            </div>
            {error && <p className="text-xs text-status-error">{error}</p>}
            {success && (
              <p className="text-xs text-status-success">{success}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                {t("close")}
              </Button>
              <Button type="submit" size="sm" loading={loading}>
                {t("sendInvites")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shows a freshly generated temporary password exactly once. The backend
 *  never stores or logs it past the response that created this dialog, so
 *  closing without copying means generating a new one from scratch. */
function ResetPasswordResultDialog({
  result,
  onClose,
}: {
  result: { user: User; password: string } | null;
  onClose: () => void;
}) {
  const t = useTranslations("settings.admin.resetPassword");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setCopied(false);
  }, [result]);

  const handleCopy = async () => {
    if (!result) return;
    if (await copyToClipboard(result.password)) {
      setCopied(true);
    }
  };

  return (
    <Dialog.Root open={!!result} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="glass-panel fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Close className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </Dialog.Close>

          <Dialog.Title className="text-base font-semibold text-text-primary">
            {t("titleFor", { name: result?.user.name ?? "" })}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {t("description", { email: result?.user.email ?? "" })}
          </Dialog.Description>

          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
              {result?.password}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="gap-1">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-status-success" /> {t("copied")}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> {t("copy")}
                </>
              )}
            </Button>
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="button" size="sm" onClick={onClose}>
              {t("done")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function userStatusBadge(status: UserStatus, t: (key: string) => string) {
  const map: Record<UserStatus, { label: string; className: string }> = {
    active: {
      label: t("status.active"),
      className: "bg-status-success/15 text-status-success",
    },
    deactivated: {
      label: t("status.deactivated"),
      className: "bg-status-error/15 text-status-error",
    },
    pending_invite: {
      label: t("status.pending"),
      className: "bg-status-warning/15 text-status-warning",
    },
    pending_verification: {
      label: t("status.unverified"),
      className: "bg-bg-tertiary text-text-secondary",
    },
  };
  const cfg = map[status] ?? map.active;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function AdminPage() {
  const t = useTranslations("settings.admin");
  const tErrors = useTranslations("errors");
  const { user, isSuperAdmin } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = React.useState<"users" | "instance" | "branding">("users");

  const { data: usersResp, isLoading: loadingUsers } = useSWR<User[]>(
    isSuperAdmin ? "/admin/users" : null,
    () => api.get<User[]>("/admin/users"),
  );

  React.useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace("/");
    }
  }, [user, isSuperAdmin, router]);

  // Deep link to a sub-tab (e.g. the old /settings/branding bookmark redirects here).
  // Read after mount so the server and client render the same initial markup.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "instance" || requested === "branding") {
      setTab(requested);
    }
  }, []);

  const handleDeactivate = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/deactivate`);
      mutate("/admin/users");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? translateApiError(err, tErrors) : t("errors.deactivate");
      alert(message);
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/reactivate`);
      mutate("/admin/users");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? translateApiError(err, tErrors) : t("errors.reactivate");
      alert(message);
    }
  };

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [resetResult, setResetResult] = React.useState<{ user: User; password: string } | null>(null);

  const handleResetPassword = async (u: User) => {
    setResettingId(u.id);
    try {
      const res = await api.post<{ temporary_password: string }>(
        `/admin/users/${u.id}/reset-password`,
      );
      setResetResult({ user: u, password: res.temporary_password });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? translateApiError(err, tErrors) : t("resetPassword.error");
      alert(message);
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyInviteLink = async (u: User) => {
    if (!u.invite_token) return;
    const link = `${window.location.origin}/invite/${u.invite_token}`;
    // copyToClipboard falls back to execCommand in insecure contexts (e.g. plain
    // HTTP on a LAN IP), where navigator.clipboard is undefined and would throw.
    if (await copyToClipboard(link)) {
      setCopiedId(u.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleToggleAdmin = async (
    userId: string,
    isCurrentlyAdmin: boolean,
  ) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, {
        is_admin: !isCurrentlyAdmin,
      });
      mutate("/admin/users");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? translateApiError(err, tErrors) : t("errors.toggleRole");
      alert(message);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted">
          <Shield className="h-5 w-5 text-text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {t("heading")}
          </h1>
          <p className="text-sm text-text-secondary">
            {tab === "instance"
              ? t("tabDescription.instance")
              : tab === "branding"
                ? t("tabDescription.branding")
                : t("tabDescription.users")}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["users", "instance", "branding"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-accent text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "instance" && <InstanceSettingsTab />}
      {tab === "branding" && <BrandingTab />}

      {/* User management */}
      {tab === "users" && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("platformUsers")}
          </h2>
          <BulkInviteDialog />
        </div>

        {loadingUsers ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-bg-tertiary"
              />
            ))}
          </div>
        ) : !usersResp || usersResp.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-secondary">
            <EmptyState
              icon={Users}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-tertiary">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">
                    {t("table.user")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">
                    {t("table.role")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">
                    {t("table.status")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">
                    {t("table.joined")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-tertiary">
                    {t("table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersResp.map((u: User) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={u.avatar_url} name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-text-tertiary truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_superadmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          <Shield className="h-3 w-3" />
                          {t("roleAdmin")}
                        </span>
                      ) : (
                        <span className="text-xs text-text-tertiary">{t("roleUser")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{userStatusBadge(u.status, t)}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === "pending_invite" && u.invite_token && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyInviteLink(u)}
                            className="gap-1"
                          >
                            {copiedId === u.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-status-success" />{" "}
                                {t("copied")}
                              </>
                            ) : (
                              <>
                                <Link2 className="h-3.5 w-3.5" /> {t("copyInviteLink")}
                              </>
                            )}
                          </Button>
                        )}
                        {u.status !== "pending_invite" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={resettingId === u.id}
                            onClick={() => handleResetPassword(u)}
                            className="gap-1"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> {t("resetPasswordAction")}
                          </Button>
                        )}
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleToggleAdmin(u.id, u.is_superadmin)
                            }
                          >
                            {u.is_superadmin ? t("removeAdmin") : t("makeAdmin")}
                          </Button>
                        )}
                        {u.id !== user?.id && u.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(u.id)}
                            className="text-status-error hover:text-status-error"
                          >
                            {t("deactivate")}
                          </Button>
                        ) : u.id !== user?.id && u.status === "deactivated" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(u.id)}
                          >
                            {t("reactivate")}
                          </Button>
                        ) : u.id === user?.id ? (
                          <span className="text-xs text-text-tertiary italic">
                            {t("you")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      <ResetPasswordResultDialog result={resetResult} onClose={() => setResetResult(null)} />
    </div>
  );
}
