"use client";

import * as React from "react";
import { Bell, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const commentNotifications = ["general_comments", "comment_replies", "mentions"];

const assetNotifications = ["other_uploads", "status_updates", "assigned_to_you"];

interface NotifPrefs {
  email_frequency: string;
  general_comments: string;
  comment_replies: string;
  mentions: string;
  other_uploads: string;
  status_updates: string;
  assigned_to_you: string;
  [key: string]: string;
}

const defaults: NotifPrefs = {
  email_frequency: "instant",
  general_comments: "all_on",
  comment_replies: "all_on",
  mentions: "all_on",
  other_uploads: "all_on",
  status_updates: "all_on",
  assigned_to_you: "all_on",
};

export default function NotificationsPage() {
  const t = useTranslations("settings.notifications");
  const { user } = useAuthStore();
  const [prefs, setPrefs] = React.useState<NotifPrefs>(defaults);
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Load from user preferences
  React.useEffect(() => {
    if (!user?.preferences) return;
    const notif = (user.preferences.notifications ?? {}) as Record<
      string,
      unknown
    >;
    const merged: NotifPrefs = { ...defaults };
    Object.entries(notif).forEach(([key, value]) => {
      if (typeof value === "string") {
        merged[key] = value;
      }
    });
    setPrefs(merged);
    setLoaded(true);
  }, [user?.preferences]);

  async function updatePref(key: string, value: string) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    try {
      await api.patch("/auth/me/preferences", { notifications: updated });
    } catch {}
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted">
          <Bell className="h-5 w-5 text-text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text-primary">
            {t("heading")}
          </h1>
          <p className="text-sm text-text-secondary">
            {t("subheading")}
          </p>
        </div>
        {saving && (
          <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
        )}
      </div>

      {/* Email Frequency */}
      <section className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-bg-secondary">
          <Bell className="h-5 w-5 text-text-secondary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">
              {t("emailFrequency.title")}
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              {t("emailFrequency.description")}
            </p>
            <select
              value={prefs.email_frequency}
              onChange={(e) => updatePref("email_frequency", e.target.value)}
              className="mt-3 w-40 rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="instant">{t("emailFrequency.options.instant")}</option>
              <option value="15min">{t("emailFrequency.options.15min")}</option>
              <option value="hourly">{t("emailFrequency.options.hourly")}</option>
              <option value="daily">{t("emailFrequency.options.daily")}</option>
              <option value="never">{t("emailFrequency.options.never")}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Comments Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">{t("comments")}</h2>
        <div className="space-y-3">
          {commentNotifications.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-bg-secondary"
            >
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  {t(`items.${id}.title`)}
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {t(`items.${id}.description`)}
                </p>
              </div>
              <select
                value={prefs[id] || "all_on"}
                onChange={(e) => updatePref(id, e.target.value)}
                className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all_on">{t("levelOptions.all_on")}</option>
                <option value="in_app">{t("levelOptions.in_app")}</option>
                <option value="all_off">{t("levelOptions.all_off")}</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Assets Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">{t("assets")}</h2>
        <div className="space-y-3">
          {assetNotifications.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-bg-secondary"
            >
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  {t(`items.${id}.title`)}
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {t(`items.${id}.description`)}
                </p>
              </div>
              <select
                value={prefs[id] || "all_on"}
                onChange={(e) => updatePref(id, e.target.value)}
                className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all_on">{t("levelOptions.all_on")}</option>
                <option value="in_app">{t("levelOptions.in_app")}</option>
                <option value="all_off">{t("levelOptions.all_off")}</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
        <p className="text-xs text-text-secondary">
          {t("adminNote")}
        </p>
      </div>
    </div>
  );
}
