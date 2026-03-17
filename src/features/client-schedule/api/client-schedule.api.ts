import { ClientShift, Client } from "../model/types";
import { mockClients, storageShifts } from "../model/mockData";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const clientScheduleApi = {
  fetchClients: async (): Promise<Client[]> => {
    await delay(300);
    return mockClients;
  },

  fetchShifts: async (startDate: string, endDate: string): Promise<ClientShift[]> => {
    await delay(500);
    return storageShifts.filter(s => s.date >= startDate && s.date <= endDate);
  },

  createShift: async (shift: Omit<ClientShift, "id">): Promise<ClientShift> => {
    await delay(400);
    const newShift = { ...shift, id: Math.random().toString(36).substr(2, 9) };
    const client = mockClients.find(c => c.id === shift.clientId);
    const shiftWithClient = { ...newShift, client };
    // В реальном приложении мы бы пушили в массив или БД
    // storageShifts.push(shiftWithClient as ClientShift); 
    return shiftWithClient as ClientShift;
  },

  deleteShift: async (id: string): Promise<boolean> => {
    await delay(300);
    // storageShifts = storageShifts.filter(s => s.id !== id);
    return true;
  }
};
