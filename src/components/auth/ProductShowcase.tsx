import { Button, Typography } from "ft-design-system";
import { loginSlides } from "@/components/auth/loginSlides";
import { rem14 } from "@/lib/rem";

export function ProductShowcase() {
  const slide = loginSlides[0];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: rem14(24),
        padding: `${rem14(16)} 0`,
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `0 ${rem14(20)}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: rem14(3) }}>
          <div
            style={{
              width: rem14(7),
              height: rem14(7),
              borderRadius: "50%",
              backgroundColor: "var(--text-secondary)",
            }}
          />
          <Typography variant="body-secondary-semibold" color="primary">
            What&apos;s New?
          </Typography>
        </div>

        <Button variant="secondary" icon="chevron-right" iconPosition="trailing">
          View Release
        </Button>
      </div>

      <div style={{ flex: 1, display: "flex", padding: `0 ${rem14(20)}` }}>
        <div
          style={{
            border: "1px solid var(--border-primary)",
            borderRadius: rem14(16),
            padding: rem14(40),
            display: "flex",
            flexDirection: "column",
            gap: rem14(32),
            background: slide.cardGradient,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
            overflow: "hidden",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: rem14(12) }}>
            <Typography
              variant="title-primary"
              style={{
                color: "var(--primary)",
                background: slide.textGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: rem14(32),
                fontWeight: 600,
              }}
            >
              {slide.title}
            </Typography>
            <Typography variant="body-primary-regular" color="secondary">
              {slide.description}
            </Typography>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: rem14(8),
              overflow: "hidden",
            }}
          >
            <img
              src={slide.image}
              alt={slide.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: rem14(36),
            height: rem14(8),
            borderRadius: rem14(100),
            backgroundColor: "var(--primary)",
          }}
        />
      </div>
    </div>
  );
}
