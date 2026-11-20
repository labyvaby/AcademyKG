import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { branchPath, branchTitle, findBranch, useBookInfo } from "./BookContext";
import { BookShell, Loading, StepMessage } from "./shared";
import { BORDER, CARD_SHADOW, hoverLift, RADIUS, TILE_RADIUS } from "./theme";

// /book — выбор филиала. Один филиал — сразу на его страницу. Старые ссылки
// /book?branch=<id>&service=&specialist=&date=&time= ведут на новые адреса.

function legacyTarget(params: URLSearchParams, ref: string): string {
  const query = new URLSearchParams();
  const service = params.get("service");
  if (service) query.set("service", service);
  const specialist = params.get("specialist");
  if (specialist) {
    ["date", "time"].forEach((key) => params.get(key) && query.set(key, params.get(key)!));
  }
  const qs = query.toString() ? `?${query}` : "";
  return specialist ? `/book/${ref}/specialist/${specialist}${qs}` : `/book/${ref}${qs}`;
}

const BranchPickerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { info, loading, error, reload } = useBookInfo();
  const branches = React.useMemo(() => info?.branches ?? [], [info]);
  const allLanguages = React.useMemo(
    () => [...new Set(branches.flatMap((b) => b.languages))],
    [branches],
  );

  if (loading && !info) {
    return (
      <BookShell>
        <Loading />
      </BookShell>
    );
  }
  if (error || branches.length === 0) {
    return (
      <BookShell narrow>
        <StepMessage
          title={error ? t("book.errors.loadTitle") : t("book.unavailableTitle")}
          text={error ? t("book.errors.loadText") : t("book.unavailableText")}
          action={error ? <Button onClick={reload}>{t("book.retry")}</Button> : undefined}
        />
      </BookShell>
    );
  }

  const legacyRef = params.get("branch");
  if (legacyRef) {
    const branch = findBranch(branches, legacyRef);
    return <Navigate to={legacyTarget(params, branch ? branch.slug || branch.id : legacyRef)} replace />;
  }
  if (branches.length === 1) return <Navigate to={branchPath(branches[0])} replace />;

  return (
    <BookShell languages={allLanguages} title={t("book.steps.branch")} subtitle={t("book.steps.branchHint")}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {branches.map((branch) => (
          <Box
            key={branch.id}
            component="button"
            type="button"
            onClick={() => navigate(branchPath(branch))}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2.5,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              color: "text.primary",
              bgcolor: "background.paper",
              border: 1,
              borderColor: BORDER,
              borderRadius: RADIUS,
              boxShadow: CARD_SHADOW,
              transition: "transform .15s, box-shadow .15s, border-color .15s",
              "&:hover": hoverLift(theme),
            })}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: TILE_RADIUS,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PlaceOutlined />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700}>{branchTitle(branch)}</Typography>
              {branch.address && (
                <Typography variant="body2" color="text.secondary">
                  {branch.address}
                </Typography>
              )}
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: "action.hover" }}>
                  {t(`book.country.${branch.country}`)}
                </Typography>
              </Stack>
            </Box>
            <ChevronRightOutlined sx={{ color: "text.secondary" }} />
          </Box>
        ))}
      </Box>
    </BookShell>
  );
};

export default BranchPickerPage;
