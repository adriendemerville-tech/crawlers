/**
 * Centralized toast helpers to avoid repeating the same patterns.
 */
import { toast } from 'sonner';

export const toastError = (description: string, title = 'Erreur') => {
  toast.error(title, { description });
};

export const toastSuccess = (description: string, title = 'Succès') => {
  toast.success(title, { description });
};

export const toastRetry = (description = 'Veuillez réessayer dans quelques instants.') => {
  toast('Réessayez', { description });
};
