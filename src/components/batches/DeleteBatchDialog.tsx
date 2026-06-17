"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteBatchDialogProps {
  batchId: string;
  batchName: string;
}

export function DeleteBatchDialog({ batchId, batchName }: DeleteBatchDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error("Delete failed: response not ok");
      }

      window.location.href = "/batches";
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Delete failed:", error);
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Batch</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{batchName}</strong> and all associated diary entries. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
