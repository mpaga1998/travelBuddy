import { Modal, Button } from "../../../components/ui";

/** Confirmation dialog before permanently deleting a public pin. */
export function DeleteConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      onClose={onCancel}
      label="Delete pin"
      zClassName="z-[9999]"
      backdropClassName="bg-black/35"
      panelClassName="w-[min(400px,100%)] p-6 text-ink text-center"
    >
      <div className="text-[32px] mb-3">🗑️</div>
      <div className="font-extrabold text-base mb-2 leading-snug">
        Are you sure you want to delete your pin? 😢
      </div>
      <div className="text-sm opacity-85 mb-6">
        It looked like a great place!
      </div>
      <div className="flex gap-2.5 justify-center">
        <Button variant="secondary" onClick={onCancel} autoFocus className="font-extrabold">
          No
        </Button>
        <Button variant="danger" onClick={onConfirm} className="font-extrabold">
          Yes, delete
        </Button>
      </div>
    </Modal>
  );
}
