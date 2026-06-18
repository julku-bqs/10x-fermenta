import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteBatchDialogProps {
  batchId: string;
  batchName: string;
}

export function DeleteBatchDialog({ batchId, batchName }: DeleteBatchDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let message = "Failed to delete batch";
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const body = (await response.json()) as { error?: string };
          if (body.error) {
            message = body.error;
          }
        }
        throw new Error(message);
      }

      window.location.href = "/batches";
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete batch");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive">
            Delete Batch
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{batchName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The batch and all associated diary entries will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete Batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {errorMessage && (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
