import React, { useState } from "react";
import { useSearchParams } from "react-router";
import { Box, Grid, Typography, Tabs, Tab } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { AppBottomSheet, PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { usePatientSearchWithCache } from "./usePatientSearchWithCache";
import { usePatientHistory } from "./usePatientHistory";
import { useVisitForm } from "./useVisitForm";
import PatientList from "./components/PatientList";
import PatientHistoryPanel from "./components/PatientHistoryPanel";
import PatientCard from "./components/PatientCard";
import VisitCreateDialog from "./components/VisitCreateDialog";
import { useVisitEditForm } from "./useVisitEditForm";
import AddPatientDrawer from "../../components/patients/AddPatientDrawer";
import EditPatientDrawer from "../../components/patients/EditPatientDrawer";
import { AppointmentDetailsCard } from "../home/components/AppointmentDetailsCard";
import { Drawer } from "@mui/material";
import type { Patient, HistoryRow } from "../../types/models";
import type { PatientDocument } from "./components/PatientCard";
import { usePermissions } from "../../hooks/usePermissions";
import { PERMISSIONS } from "../../constants/permissions";

import { usePatientBalance } from "./usePatientBalance";
import BalanceTopUpDrawer from "./components/BalanceTopUpDrawer";
import { apiFetch, resolveApiUrl } from "../../utility/apiClient";

/**
 * PatientSearchPage
 */


export const PatientSearchPage: React.FC = () => {
  usePageTitle("Поиск клиентов");
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addInitialPhone, setAddInitialPhone] = React.useState("");

  React.useEffect(() => {
    if (searchParams.get("create_patient") === "true") {
      const ph = searchParams.get("phone");
      if (ph) setAddInitialPhone(ph);
      setAddOpen(true);

      const newParams = new URLSearchParams(searchParams);
      newParams.delete("create_patient");
      newParams.delete("phone");
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  const canCreatePatient = hasPermission(PERMISSIONS.RECEPTION_READ);
  const canUpdatePatient = hasPermission(PERMISSIONS.CLIENTS_UPDATE);



  const {
    loading,
    errorMsg,
    patients,
    query,
    setQuery,
    hasMore,
    loadMore,
    reload,
    patchPatient,
    selectedPatient: selected,
    setSelectedPatient: setSelected,
  } = usePatientSearchWithCache();

  // Vitals + documents — load from client detail endpoint; also enrich selected with full data
  const [vitals, setVitals] = useState<{ weight?: number | null; height?: number | null; temperature?: number | null } | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);

  function resolvePhoto(url: string | null | undefined): string | null {
    return resolveApiUrl(url);
  }
  function resolveFileUrl(url: string | null | undefined): string {
    return resolveApiUrl(url) ?? "";
  }

  const loadClientDetail = React.useCallback(async (id: string) => {
    const res: any = await apiFetch(`/api/v1/clients/${id}/`);
    return res?.data ?? res;
  }, []);

  React.useEffect(() => {
    const selectedId = String(selected?.id ?? "").trim();
    if (!selectedId) {
      setVitals(null);
      setDocuments([]);
      setBalance(null);
      return;
    }
    // При выборе другого клиента сразу убираем связанные данные предыдущего.
    setVitals(null);
    setDocuments([]);
    setBalance(null);
    let active = true;
    (async () => {
      try {
        const data = await loadClientDetail(selectedId);
        // Enrich selected patient with fresh full data (photo, blacklist_reason, etc.)
        if (active) {
          const patch = {
            fio: String(data?.fullName ?? ""),
            phone: (data?.phone as string) ?? undefined,
            photo: resolvePhoto(data?.photoUrl) ?? undefined,
            birth_date: (data?.birthDate as string) ?? null,
            inn: (data?.inn as string) ?? null,
            is_blacklisted: (data?.isBlacklisted as boolean) ?? false,
            blacklist_reason: (data?.blacklistReason as string) ?? null,
            responsiblePersons: Array.isArray(data?.responsiblePersons)
              ? data.responsiblePersons.map((p: any) => ({ fullName: String(p?.fullName ?? ""), phone: String(p?.phone ?? "") }))
              : undefined,
          };
          setSelected((prev) => {
            if (!prev || prev.id !== selectedId) return prev;
            return { ...prev, ...patch };
          });
          // Обновляем фото и данные в списке клиентов
          patchPatient(selectedId, patch);
        }
        // Balance
        if (active) {
          const bal = data?.balance;
          setBalance(bal
            ? {
                balance: Number(bal.balance) || 0,
                cashBalance: Number(bal.cashBalance ?? bal.cash_balance) || 0,
                cardBalance: Number(bal.cardBalance ?? bal.card_balance) || 0,
                bonuses: Number(bal.bonuses) || 0,
              }
            : { balance: 0, cashBalance: 0, cardBalance: 0, bonuses: 0 });
        }
        // Documents
        if (active) {
          const docs: PatientDocument[] = Array.isArray(data?.documents)
            ? data.documents.map((d: any) => ({
                id: String(d.id ?? ""),
                title: String(d.title ?? d.fileName ?? ""),
                file: resolveFileUrl(d.file ?? d.fileUrl ?? d.url ?? ""),
                createdAt: d.createdAt ?? d.created_at,
              }))
            : [];
          setDocuments(docs);
        }
        // Try to get vitals from latest appointment if embedded, otherwise leave null
        const lastApt = Array.isArray(data?.appointments) ? data.appointments[0] : null;
        if (active) {
          setVitals(lastApt ? {
            weight: lastApt.weight ?? null,
            height: lastApt.height ?? null,
            temperature: lastApt.temperature ?? null,
          } : null);
        }
      } catch {
        if (active) {
          setVitals(null);
          setDocuments([]);
          setBalance(null);
        }
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleAddDocument = React.useCallback(async (title: string, file: File) => {
    if (!selected) return;
    const fd = new FormData();
    fd.append("patient", selected.id);
    fd.append("title", title);
    fd.append("file", file);
    await apiFetch("/api/v1/client-documents/", { method: "POST", body: fd });
    // Reload documents
    const data = await loadClientDetail(selected.id);
    const docs: PatientDocument[] = Array.isArray(data?.documents)
      ? data.documents.map((d: any) => ({
          id: String(d.id ?? ""),
          title: String(d.title ?? d.fileName ?? ""),
          file: resolveFileUrl(d.file ?? d.fileUrl ?? d.url ?? ""),
          createdAt: d.createdAt ?? d.created_at,
        }))
      : [];
    setDocuments(docs);
   
  }, [selected, loadClientDetail]);

  const handleDeleteDocument = React.useCallback(async (docId: string | number) => {
    await apiFetch(`/api/v1/client-documents/${docId}/`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const {
    history,
    loading: historyLoading,
    errorMsg: historyError,
    invalidate: invalidateHistoryCache,
    reload: reloadHistory,
  } = usePatientHistory(selected);

  const visit = useVisitForm(selected, {
    onSuccess: () => {
      try { invalidateHistoryCache(); } catch { /* noop */ }
      reloadHistory();
    },
  });

  const visitEdit = useVisitEditForm({
    onSuccess: () => {
      try { invalidateHistoryCache(); } catch { /* noop */ }
      reloadHistory();
    },
  });

  const {
    submitting: balanceSubmitting,
    submitError: balanceSubmitError,
    topUp,
  } = usePatientBalance(selected?.id);

  const [balance, setBalance] = React.useState<import("./usePatientBalance").PatientBalance | null>(null);

  const [topUpOpen, setTopUpOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const [historyDetailId, setHistoryDetailId] = React.useState<string | null>(null);
  const [historyTab, setHistoryTab] = React.useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const fullScreen = isMobile;

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  const [tabletTab, setTabletTab] = React.useState(0);

  const handleSelectPatient = (p: Patient) => {
    setSelected(p);
    if (isMobile) {
      setActiveTab(0);
      setMobileOpen(true);
    }
  };

  const patientCardProps = selected
    ? {
        fio: selected.fio,
        phone: selected.phone,
        photo: selected.photo ?? undefined,
        birth_date: selected.birth_date ?? null,
        inn: selected.inn ?? null,
        is_blacklisted: selected.is_blacklisted ?? null,
        blacklist_reason: selected.blacklist_reason ?? null,
        responsiblePersons: selected.responsiblePersons,
        is_employee_child: selected.is_employee_child ?? null,
        employee_parent_name: selected.employee_parent_name ?? null,
        employee_child_discount_percent: selected.employee_child_discount_percent ?? null,
      }
    : null;

  const patientCardDocProps = canUpdatePatient
    ? { documents, onAddDocument: handleAddDocument, onDeleteDocument: handleDeleteDocument }
    : {};

  const tabs = [
    {
      label: "Карточка",
      content: (
        <PatientCard
          patient={patientCardProps}
          lastDateTime={history[0]?.["Дата и время"]}
          lastService={history[0]?.["Услуга"]}
          lastComplaints={history[0]?.["Жалобы при обращении"]}
          lastWeight={vitals?.weight}
          lastHeight={vitals?.height}
          lastTemperature={vitals?.temperature}
          onEdit={canUpdatePatient ? () => setEditOpen(true) : undefined}
          onTopUp={canUpdatePatient ? () => setTopUpOpen(true) : undefined}
          balance={balance}
          {...patientCardDocProps}
        />
      ),
    },
    {
      label: "История",
      content: (
        <PatientHistoryPanel
          selected={!!selected}
          loading={historyLoading}
          errorMsg={historyError}
          history={history}
          onClick={(row) => {
            setHistoryDetailId(row.ID);
          }}
        />
      ),
    },
  ];

  return (
    <Box
      sx={{
        height: {
          xs: "calc(100dvh - 56px)",
          md: "calc(100dvh - 64px)",
          lg: "100%",
        },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PageHeader
        title="Поиск клиента"
        showTitle={false}
        addButtonText="Добавить клиент"
        onAdd={canCreatePatient ? () => setAddOpen(true) : undefined}
        showSearch
        searchVal={query}
        onSearchChange={setQuery}
        searchPlaceholder="Поиск..."
        loading={loading}
      />

      <Box
        sx={(theme) => ({
          px: theme.appLayout.page.paddingX,
          pb: theme.appLayout.page.paddingY,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        })}
      >
        <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          {/* Левая колонка: Список клиентов */}
          <Grid
            item
            xs={12}
            md={5}
            lg={3}
            sx={{
              position: { md: "sticky" },
              top: { md: (theme) => theme.spacing(8) },
              alignSelf: { xs: "stretch", md: "flex-start", lg: "stretch" },
              height: {
                xs: "100%",
                md: (theme) => theme.appLayout.viewportOffset.patientSearch.listTabletHeight,
                lg: "100%",
              },
              overflow: "hidden",
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", height: 1, minHeight: 0 }}>
              <PatientList
                loading={loading}
                errorMsg={errorMsg}
                patients={patients}
                selectedId={selected?.id ?? null}
                onSelect={handleSelectPatient}
                hasMore={hasMore}
                loadMore={loadMore}
              />
            </Box>
          </Grid>

          {/* ===== Планшет (md–lg): одна правая колонка с табами ===== */}
          {isTablet && (
            <Grid item md={7} sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              {selected ? (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <Tabs
                    value={tabletTab}
                    onChange={(_, v) => setTabletTab(v)}
                    variant="fullWidth"
                    sx={{ flexShrink: 0, mb: 1 }}
                  >
                    <Tab label="Карточка" />
                    <Tab label="История" />
                  </Tabs>
                  <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
                    {tabletTab === 0 && (
                      <PatientCard
                        patient={patientCardProps}
                        lastDateTime={history[0]?.["Дата и время"]}
                        lastService={history[0]?.["Услуга"]}
                        lastComplaints={history[0]?.["Жалобы при обращении"]}
                        lastWeight={vitals?.weight}
                        lastHeight={vitals?.height}
                        lastTemperature={vitals?.temperature}
                        onEdit={canUpdatePatient ? () => setEditOpen(true) : undefined}
                        onTopUp={canUpdatePatient ? () => setTopUpOpen(true) : undefined}
                        balance={balance}
                        {...patientCardDocProps}
                      />
                    )}
                    {tabletTab === 1 && (
                      <PatientHistoryPanel
                        selected={!!selected}
                        loading={historyLoading}
                        errorMsg={historyError}
                        history={history}
                        onClick={(row) => setHistoryDetailId(row.ID)}
                      />
                    )}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ px: 2, py: 4, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography color="text.secondary">Выберите клиента слева</Typography>
                </Box>
              )}
            </Grid>
          )}

          {/* ===== Десктоп (>= lg): три колонки — Карточка + История ===== */}
          {isDesktop && (
            <>
              <Grid item lg={4} sx={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
                {selected ? (
                  <PatientCard
                    patient={patientCardProps}
                    lastDateTime={history[0]?.["Дата и время"]}
                    lastService={history[0]?.["Услуга"]}
                    lastComplaints={history[0]?.["Жалобы при обращении"]}
                    lastWeight={vitals?.weight}
                    lastHeight={vitals?.height}
                    lastTemperature={vitals?.temperature}
                    onEdit={canUpdatePatient ? () => setEditOpen(true) : undefined}
                    onTopUp={canUpdatePatient ? () => setTopUpOpen(true) : undefined}
                    balance={balance}
                    {...patientCardDocProps}
                  />
                ) : (
                  <Box sx={{ px: 2, py: 4, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Карточка клиента</Typography>
                  </Box>
                )}
              </Grid>

              <Grid item lg={5} sx={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
                <PatientHistoryPanel
                  selected={!!selected}
                  loading={historyLoading}
                  errorMsg={historyError}
                  history={history}
                  onClick={(row) => setHistoryDetailId(row.ID)}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Box>

      {/* Drawer: Добавить клиента */}
      <AddPatientDrawer
        open={addOpen}
        initialPhone={addInitialPhone}
        onClose={() => {
          setAddOpen(false);
          setAddInitialPhone("");
        }}
        onCreated={(p) => {
          setAddOpen(false);
          reload();
          setSelected({
            id: p.id,
            fio: p.fio,
            phone: p.phone ?? undefined,
            photo: p.photo ?? undefined,
            birth_date: p.birth_date ?? null,
            inn: p.inn ?? null,
            is_blacklisted: p.is_blacklisted ?? null,
            blacklist_reason: p.blacklist_reason ?? null,
            responsiblePersons: p.responsiblePersons,
          });
        }}
      />

      <EditPatientDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patientId={selected?.id ?? null}
        initialPhoto={selected?.photo ?? null}
        onUpdated={(u) => {
          setSelected((prev) => ({
            id: u.id,
            fio: u.fio,
            phone: u.phone ?? undefined,
            photo: u.photo ?? undefined,
            birth_date: u.birth_date ?? null,
            inn: u.inn ?? null,
            is_blacklisted: u.is_blacklisted ?? null,
            blacklist_reason: u.blacklist_reason ?? null,
            responsiblePersons: u.responsiblePersons ?? prev?.responsiblePersons,
          }));
          setEditOpen(false);
          reload();
        }}
      />

      {/* Dialog: Создать прием */}
      <VisitCreateDialog
        open={visit.open}
        fullScreen={fullScreen}
        dateTime={visit.dateTime}
        doctor={visit.doctor}
        service={visit.service}
        price={visit.price}
        onChangeDateTime={visit.setDateTime}
        onChangeDoctor={visit.setDoctor}
        onChangeService={visit.setService}
        onChangePrice={visit.setPrice}
        onClose={() => visit.setOpen(false)}
        onSubmit={visit.submit}
        submitting={visit.submitting}
        disabled={!selected}
      />

      {/* Dialog: Редактировать прием */}
      <VisitCreateDialog
        open={visitEdit.open}
        fullScreen={fullScreen}
        mode="edit"
        dateTime={visitEdit.dateTime}
        doctor={visitEdit.doctor}
        service={visitEdit.service}
        price={visitEdit.price}
        onChangeDateTime={visitEdit.setDateTime}
        onChangeDoctor={visitEdit.setDoctor}
        onChangeService={visitEdit.setService}
        onChangePrice={visitEdit.setPrice}
        onClose={() => visitEdit.setOpen(false)}
        onSubmit={visitEdit.submit}
        submitting={visitEdit.submitting}
      />

      {/* Bottom Sheet: Детали клиента на мобильных */}
      <AppBottomSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        header={
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="fullWidth"
            sx={{ flexShrink: 0 }}
          >
            {tabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>
        }
      >
        <Box sx={{ p: 2, px: 3 }}>
          {tabs[activeTab].content}
        </Box>
      </AppBottomSheet>

      {/* Drawer: История приема */}
      <Drawer
        anchor="right"
        open={!!historyDetailId}
        onClose={() => {
          setHistoryDetailId(null);
          setHistoryTab(0);
        }}
        PaperProps={{
          sx: {
            width: {
              xs: "100%",
              sm: "100%",
              md: isTablet ? "85%" : 600,
              lg: 600,
            },
            transition: "width 0.3s",
          },
        }}
      >
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {historyDetailId && (
            <AppointmentDetailsCard
              appointmentId={historyDetailId}
              onClose={() => {
                setHistoryDetailId(null);
                setHistoryTab(0);
              }}
              hideActionsForDoctor={!canUpdatePatient}
              onUpdate={() => reloadHistory()}
            />
          )}
        </Box>
      </Drawer>


      <BalanceTopUpDrawer
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        patientId={selected?.id ?? ""}
        patientFio={selected?.fio ?? ""}
        submitting={balanceSubmitting}
        submitError={balanceSubmitError}
        onSubmit={async (payload) => {
          const ok = await topUp(payload);
          if (ok && selected) {
            const data = await loadClientDetail(selected.id);
            const bal = data?.balance;
            setBalance(bal
              ? {
                  balance: Number(bal.balance) || 0,
                  cashBalance: Number(bal.cashBalance ?? bal.cash_balance) || 0,
                  cardBalance: Number(bal.cardBalance ?? bal.card_balance) || 0,
                  bonuses: Number(bal.bonuses) || 0,
                }
              : { balance: 0, cashBalance: 0, cardBalance: 0, bonuses: 0 });
          }
          return ok;
        }}
      />
    </Box>
  );
};

export default PatientSearchPage;
