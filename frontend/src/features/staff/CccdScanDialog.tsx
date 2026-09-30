import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanLine, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type CccdInfo, parseCccdQr } from "./cccd";
import { decodeQrFromFile, decodeQrFromVideo } from "./qrDecode";

export interface CccdScanResult {
  info: CccdInfo | null;
  front: File | null;
  back: File | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (result: CccdScanResult) => void;
}

function ImageSlot({ label, file, onSelect, testId }: { label: string; file: File | null; onSelect: (file: File) => void; testId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid={testId}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-full aspect-[16/10] rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden",
          "hover:border-primary/60 hover:bg-muted/40 transition-colors",
          preview && "border-solid",
        )}
      >
        {preview ? (
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
            <Upload className="w-6 h-6" />
            Chọn hoặc chụp ảnh
          </span>
        )}
      </button>
    </div>
  );
}

/** Quét camera liên tục cho tới khi đọc được QR. */
function CameraScanner({ onDecode, onClose }: { onDecode: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = window.setInterval(() => {
          const text = videoRef.current ? decodeQrFromVideo(videoRef.current) : null;
          if (text) onDecode(text);
        }, 300);
      } catch {
        setError("Không mở được camera. Hãy cho phép truy cập camera hoặc chọn ảnh chụp sẵn.");
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDecode]);

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
      )}
      <p className="text-xs text-muted-foreground">Đưa mã QR trên CCCD vào giữa khung hình, giữ yên vài giây.</p>
      <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
        <X className="w-4 h-4 mr-1" /> Tắt camera
      </Button>
    </div>
  );
}

/**
 * Quét CCCD (thay CCCDUploadModal cũ): chọn/chụp ảnh 2 mặt, đọc mã QR ở mặt trước để điền sẵn hồ sơ; ảnh 2 mặt
 * được lưu làm giấy tờ sau khi tạo nhân viên. Không đọc được QR thì vẫn dùng ảnh và nhập tay.
 */
export function CccdScanDialog({ open, onOpenChange, onApply }: Props) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [info, setInfo] = useState<CccdInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "failed">("idle");
  const [camera, setCamera] = useState(false);

  useEffect(() => {
    if (!open) {
      setFront(null);
      setBack(null);
      setInfo(null);
      setStatus("idle");
      setCamera(false);
    }
  }, [open]);

  const readFront = async (file: File) => {
    setFront(file);
    setStatus("reading");
    try {
      const parsed = parseCccdQr((await decodeQrFromFile(file)) ?? "");
      setInfo(parsed);
      setStatus(parsed ? "idle" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  // useCallback: CameraScanner mở lại camera mỗi khi hàm này đổi
  const onCameraDecode = useCallback((text: string) => {
    const parsed = parseCccdQr(text);
    if (parsed) {
      setInfo(parsed);
      setStatus("idle");
      setCamera(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quét CCCD</DialogTitle>
          <DialogDescription>
            Chụp mặt trước (có mã QR ở góc trên bên phải) để điền sẵn số CCCD, họ tên, ngày sinh, giới tính, ngày cấp.
          </DialogDescription>
        </DialogHeader>

        {camera ? (
          <CameraScanner onDecode={onCameraDecode} onClose={() => setCamera(false)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageSlot label="Mặt trước" file={front} onSelect={readFront} testId="cccd-front" />
            <ImageSlot label="Mặt sau" file={back} onSelect={setBack} testId="cccd-back" />
          </div>
        )}

        {!camera && (
          <Button type="button" variant="outline" onClick={() => setCamera(true)} className="min-h-11 w-fit">
            <Camera className="w-4 h-4 mr-2" /> Quét mã QR bằng camera
          </Button>
        )}

        {status === "reading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang đọc mã QR...
          </p>
        )}
        {status === "failed" && (
          <p className="text-sm text-amber-700">
            Không đọc được mã QR. Hãy chụp rõ, đủ sáng mặt trước, hoặc quét bằng camera. Bạn vẫn có thể dùng ảnh và nhập tay.
          </p>
        )}
        {info && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1" data-testid="cccd-info">
            <p className="flex items-center gap-2 font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" /> Đã đọc thông tin từ mã QR
            </p>
            <p>Số CCCD: <b>{info.citizenId}</b></p>
            <p>Họ tên: <b>{info.fullName}</b></p>
            {info.dob && <p>Ngày sinh: {formatDate(info.dob)}</p>}
            {info.gender && <p>Giới tính: {info.gender === "MALE" ? "Nam" : "Nữ"}</p>}
            {info.issuedOn && <p>Ngày cấp: {formatDate(info.issuedOn)}</p>}
            {info.address && <p className="text-muted-foreground">Địa chỉ trên thẻ: {info.address}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
            Hủy
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!info && !front && !back}
            onClick={() => {
              onApply({ info, front, back });
              onOpenChange(false);
            }}
          >
            <ScanLine className="w-4 h-4 mr-2" /> Dùng thông tin này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
