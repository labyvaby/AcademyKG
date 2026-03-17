import React, { useState } from "react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { ClientShift } from "../model/types";
import EmployeeAvatar from "../../../components/ui/EmployeeAvatar";
import PatientQuickViewDrawer from "../../../components/patients/PatientQuickViewDrawer";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  shifts: ClientShift[];
  onEdit: (shift: ClientShift) => void;
};

const ClientDayDetailsSidebar: React.FC<Props> = ({ isOpen, onClose, date, shifts, onEdit }) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, maxWidth: "100vw" } }}
    >
      <Box sx={{ width: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
          <Typography variant="h6">Приемы на {date}</Typography>
          <IconButton onClick={onClose}><CloseOutlined /></IconButton>
        </Stack>
        <Divider />

        <Box px={2} py={2}>
          {shifts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Приемов нет</Typography>
          ) : (
            <List dense>
              {shifts.map((s) => (
                <ListItem 
                  key={s.id} 
                  sx={{ 
                    border: "1px solid", 
                    borderColor: "divider", 
                    mb: 1, 
                    borderRadius: 1, 
                    flexDirection: "column", 
                    alignItems: "flex-start",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" }
                  }}
                  onClick={() => onEdit(s)}
                >
                  <Stack direction="row" alignItems="center" gap={1} sx={{ width: "100%", mb: 1 }}>
                    <EmployeeAvatar name={s.client?.fullName} size={32} />
                    <ListItemText
                      primary={
                        <Typography 
                          variant="subtitle2" 
                          sx={{ color: "primary.main", textDecoration: "underline" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatientId(s.clientId);
                          }}
                        >
                          {s.client?.fullName}
                        </Typography>
                      }
                      secondary={`${s.startTime} — ${s.endTime}`}
                    />
                  </Stack>
                  {s.isNextWeekEnd && (
                    <Typography variant="caption" color="warning.main">
                      * Заканчивается на след. неделе
                    </Typography>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Карточка пациента */}
      <PatientQuickViewDrawer 
        open={!!selectedPatientId} 
        onClose={() => setSelectedPatientId(null)} 
        patientId={selectedPatientId} 
      />
    </Drawer>
  );
};

export default ClientDayDetailsSidebar;
