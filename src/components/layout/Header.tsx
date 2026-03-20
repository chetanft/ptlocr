import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppHeader as FTAppHeader,
  Button,
  NavigationPopover,
  NavigationSection,
  NavigationSectionHero,
  NavigationSectionMetric,
  NavigationSectionSubCategory,
  NavigationSectionSubCategoryItem,
} from "ft-design-system";
import { useAuth } from "@/auth/AuthContext";
import { getOpsQueuePath, getReviewerQueuePath, getTransporterEpodPath } from "@/auth/routeUtils";
import { rem14 } from "@/lib/rem";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  const navigationConfig = useMemo(() => {
    if (user?.role === "Ops") {
      return {
        activeSectionId: "ops-review",
        itemRouteMap: new Map<string, string>([
          ["Pending Approval", getOpsQueuePath()],
          ["Config Workspace", "/config"],
          ["Config List", "/config-list"],
        ]),
        sectionRouteMap: new Map<string, string>([
          ["ops-review", getOpsQueuePath()],
          ["ocr-config", "/config"],
        ]),
        sections: [
          {
            id: "ops-review",
            label: "ePOD Review",
            icon: "document",
            hero: {
              illustrationVariant: "overview" as const,
              title: "Consignor Ops Review",
              description:
                "Review transporter-uploaded PODs, resolve OCR exceptions, and send validated cases to reviewer.",
            },
            metrics: [
              {
                variant: "highlight" as const,
                title: "Pending Approval",
                description: "Cases waiting for consignor Ops review.",
                actionLabel: "Open",
                actionIcon: "arrow-top-right",
              },
            ],
          },
          {
            id: "ocr-config",
            label: "OCR Configuration",
            icon: "settings",
            showChevron: true,
            subCategories: [
              {
                title: "CONFIGURATION",
                items: [
                  { label: "Config Workspace", icon: "data-stack", description: "Create and edit OCR configurations" },
                  { label: "Config List", icon: "menu", description: "View all active configurations" },
                ],
              },
            ],
          },
        ],
      };
    }

    if (user?.role === "Reviewer") {
      return {
        activeSectionId: "reviewer-approval",
        itemRouteMap: new Map<string, string>([
          ["Pending Review", getReviewerQueuePath()],
          ["Config Workspace", "/config"],
          ["Config List", "/config-list"],
        ]),
        sectionRouteMap: new Map<string, string>([
          ["reviewer-approval", getReviewerQueuePath()],
          ["ocr-config", "/config"],
        ]),
        sections: [
          {
            id: "reviewer-approval",
            label: "Final Approval",
            icon: "reconciliation",
            hero: {
              illustrationVariant: "overview" as const,
              title: "Consignor Final Review",
              description:
                "Approve or reject Ops-reviewed ePOD reconciliation cases before downstream invoicing.",
            },
            metrics: [
              {
                variant: "highlight" as const,
                title: "Pending Review",
                description: "Reviewed cases waiting for final approval.",
                actionLabel: "Open",
                actionIcon: "arrow-top-right",
              },
            ],
          },
          {
            id: "ocr-config",
            label: "OCR Configuration",
            icon: "settings",
            showChevron: true,
            subCategories: [
              {
                title: "CONFIGURATION",
                items: [
                  { label: "Config Workspace", icon: "data-stack", description: "Create and edit OCR configurations" },
                  { label: "Config List", icon: "menu", description: "View all active configurations" },
                ],
              },
            ],
          },
        ],
      };
    }

    return {
      activeSectionId: "epod",
      itemRouteMap: new Map<string, string>([
        ["Pending Submission", getTransporterEpodPath()],
        ["Pending Approval", getTransporterEpodPath()],
        ["Rejected", getTransporterEpodPath()],
        ["Approved", getTransporterEpodPath()],
        ["Config Workspace", "/config"],
        ["Config List", "/config-list"],
      ]),
      sectionRouteMap: new Map<string, string>([
        ["epod", getTransporterEpodPath()],
        ["ocr-config", "/config"],
      ]),
      sections: [
        {
          id: "epod",
          label: "ePOD",
          icon: "document",
          hero: {
            illustrationVariant: "overview" as const,
            title: "Transporter ePOD",
            description:
              "Upload ePOD images for delivered AWBs and track their progress through consignor Ops and reviewer approval.",
          },
          metrics: [
              {
                variant: "highlight" as const,
                title: "Pending Submission",
                description: `Delivered AWBs waiting for ${user?.companyDisplayName ?? "the transporter"} to upload ePOD images.`,
                actionLabel: "Open",
                actionIcon: "arrow-top-right",
              },
            {
              variant: "highlight" as const,
              title: "Pending Approval",
              description: "Submitted ePODs currently under consignor review.",
              actionLabel: "Open",
              actionIcon: "arrow-top-right",
            },
          ],
        },
        {
          id: "ocr-config",
          label: "OCR Configuration",
          icon: "settings",
          showChevron: true,
          subCategories: [
            {
              title: "CONFIGURATION",
              items: [
                { label: "Config Workspace", icon: "data-stack", description: "Create and edit OCR configurations" },
                { label: "Config List", icon: "menu", description: "View all active configurations" },
              ],
            },
          ],
        },
      ],
    };
  }, [user?.role]);

  const activeSectionId = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/transporter/epod")) return "epod";
    if (path.startsWith("/ops/epod")) return "ops-review";
    if (path.startsWith("/reviewer/epod")) return "reviewer-approval";
    if (path.startsWith("/config")) return "ocr-config";
    return navigationConfig.activeSectionId;
  }, [location.pathname]);

  const handleSectionChange = (sectionId: string) => {
    const section = navigationConfig.sections.find((s) => s.id === sectionId);
    if (section?.subCategories?.length) return;

    const route = navigationConfig.sectionRouteMap.get(sectionId);
    if (route) {
      navigate(route);
      setIsNavigationOpen(false);
    }
  };

  const resolveRouteFromButton = (
    button: HTMLButtonElement
  ): string | null => {
    const rawText = button.textContent?.replace(/\s+/g, " ").trim();
    if (!rawText) return null;

    for (const [label, route] of navigationConfig.itemRouteMap.entries()) {
      if (rawText.includes(label)) return route;
    }
    return null;
  };

  const headerUser = user
    ? {
        name: user.name,
        avatar: undefined,
        role: user.role,
        location: user.location ?? "",
      }
    : undefined;

  const userCompany = user?.companyLogoName
    ? {
        name: user.companyLogoName,
        displayName: user.companyDisplayName,
      }
    : user?.companyLogoSrc
      ? {
          name: "custom",
          displayName: user.companyDisplayName,
        }
      : undefined;

  return (
    <div className="relative">
      <FTAppHeader
        size="xl"
        device="Desktop"
        className="w-full max-w-none"
        user={headerUser}
        userCompany={userCompany}
        userProfileProps={{ className: "overflow-hidden" }}
        onNotificationClick={(type: string) => {
          if (type === "menu") setIsNavigationOpen(true);
        }}
        onUserClick={() => {}}
        onUserMenuItemClick={(item: string) => {
          if (item === "Logout" || item === "logout") {
            logout();
            navigate("/login", { replace: true });
          }
        }}
        leftAddon={() => (
          <div className="flex items-center gap-2">
            <Button
              variant="text"
              icon="hamburger-menu"
              iconPosition="only"
              onClick={() => setIsNavigationOpen(true)}
            />
          </div>
        )}
      />

      {user?.companyLogoSrc && !user?.companyLogoName ? (
        <div
          style={{
            position: "absolute",
            right: rem14(96),
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 5,
            width: rem14(168),
            height: rem14(48),
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-primary)",
            borderRadius: rem14(12),
            padding: `0 ${rem14(12)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <img
            src={user.companyLogoSrc}
            alt={user.companyDisplayName}
            style={{
              maxWidth: "100%",
              maxHeight: rem14(28),
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      ) : null}

      {isNavigationOpen && (
        <div
          role="presentation"
          onClick={() => setIsNavigationOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--overlay-scrim)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            padding: "var(--spacing-x6)",
          }}
        >
          <div
            onClick={(event) => {
              event.stopPropagation();
              const target = event.target as HTMLElement;
              const button = target.closest("button");
              if (!button) return;

              const route = resolveRouteFromButton(button);
              if (route) {
                navigate(route);
                setIsNavigationOpen(false);
              }
            }}
            style={{ width: `min(${rem14(1200)}, 100%)`, marginLeft: 0 }}
          >
            <NavigationPopover
              open={isNavigationOpen}
              onClose={() => setIsNavigationOpen(false)}
              initialSectionId={activeSectionId}
              onSectionChange={handleSectionChange}
            >
              {navigationConfig.sections.map((section) => (
                <NavigationSection
                  key={section.id}
                  id={section.id}
                  label={section.label}
                  icon={section.icon}
                  showChevron={section.showChevron}
                >
                  {section.hero && (
                    <NavigationSectionHero
                      title={section.hero.title}
                      description={section.hero.description}
                      illustrationVariant={section.hero.illustrationVariant}
                    />
                  )}
                  {section.metrics?.map((metric, index) => (
                    <NavigationSectionMetric
                      key={`${section.id}-metric-${index}`}
                      variant={metric.variant}
                      title={metric.title}
                      description={metric.description}
                      actionLabel={metric.actionLabel}
                      actionIcon={metric.actionIcon}
                    />
                  ))}
                  {section.subCategories?.map((subCat, subIdx) => (
                    <NavigationSectionSubCategory
                      key={`${section.id}-subcat-${subIdx}`}
                      title={subCat.title}
                    >
                      {subCat.items.map((item, itemIdx) => (
                        <NavigationSectionSubCategoryItem
                          key={`${section.id}-item-${itemIdx}`}
                          label={item.label}
                          icon={item.icon}
                          description={item.description}
                        />
                      ))}
                    </NavigationSectionSubCategory>
                  ))}
                </NavigationSection>
              ))}
            </NavigationPopover>
          </div>
        </div>
      )}
    </div>
  );
}
