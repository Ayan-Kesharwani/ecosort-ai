import { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import { useAnalyzeTrash, TrashAnalysisResult } from "@workspace/api-client-react";
import { UploadCloud, CheckCircle2, AlertTriangle, Info, Recycle, Trash2, Loader2, Image as ImageIcon, Leaf, Camera, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const toCompressedBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 768;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const analyzeTrash = useAnalyzeTrash();

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    analyzeTrash.reset();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    const { base64, mimeType } = await toCompressedBase64(selectedFile);
    analyzeTrash.mutate({
      data: {
        imageBase64: base64,
        mimeType,
      }
    });
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    analyzeTrash.reset();
  };

  // ── Camera ──────────────────────────────────────────────────────────────
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError("Camera access was denied. Please allow camera permission and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const captureAndAnalyze = () => {
    const video = videoRef.current;
    if (!video) return;
    const MAX = 768;
    let w = video.videoWidth, h = video.videoHeight;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
      else { w = Math.round((w * MAX) / h); h = MAX; }
    }
    const cap = document.createElement("canvas");
    cap.width = w; cap.height = h;
    cap.getContext("2d")!.drawImage(video, 0, 0, w, h);
    const dataUrl = cap.toDataURL("image/jpeg", 0.82);
    const base64 = dataUrl.split(",")[1];
    // Show snapshot as preview
    setPreviewUrl(dataUrl);
    stopCamera();
    setIsCameraMode(false);
    analyzeTrash.mutate({ data: { imageBase64: base64, mimeType: "image/jpeg" } });
  };

  useEffect(() => {
    if (isCameraMode) startCamera();
    else stopCamera();
  }, [isCameraMode]);

  useEffect(() => () => stopCamera(), []);

  const result = analyzeTrash.data;

  const analysisError = analyzeTrash.error as { message?: string; status?: number } | null;
  const analysisErrorMessage =
    analysisError?.status === 502 || analysisError?.message?.includes("HTTP 502")
      ? "The vision service took too long to respond. Your image was resized successfully, so this is a temporary service delay—not a problem with the size of your trash pile. Please try again in a few seconds."
      : analysisError?.message ?? "Something went wrong. Please try again.";

  type ItemWithBox = { name: string; recyclable: boolean; boundingBox: { x: number; y: number; width: number; height: number } | null };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const drawBoxes = useCallback((items: ItemWithBox[]) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const { offsetWidth: w, offsetHeight: h } = img;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    items.forEach((item) => {
      const bb = item.boundingBox;
      if (!bb) return;
      const x = (bb.x / 100) * w;
      const y = (bb.y / 100) * h;
      const bw = (bb.width / 100) * w;
      const bh = (bb.height / 100) * h;
      const color = item.recyclable ? "#22c55e" : "#ef4444";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.strokeRect(x, y, bw, bh);
      ctx.shadowBlur = 0;
      // Label background
      const label = item.name;
      ctx.font = "bold 11px sans-serif";
      const tw = ctx.measureText(label).width;
      const lh = 18;
      const lpad = 5;
      ctx.fillStyle = color;
      const labelY = y > lh + 2 ? y - lh - 2 : y + bh + 2;
      ctx.fillRect(x - 1, labelY, tw + lpad * 2, lh);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + lpad - 1, labelY + lh - 5);
    });
  }, []);

  useEffect(() => {
    if (!result?.items) return;
    const img = imgRef.current;
    if (!img) return;
    const run = () => drawBoxes(result.items as ItemWithBox[]);
    if (img.complete) run();
    else img.addEventListener("load", run, { once: true });
  }, [result, drawBoxes]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">TrashScan Analyzer</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Upload an image of waste to instantly classify items, check recyclability, and receive proper handling instructions.
        </p>
      </div>

      {!result && !analyzeTrash.isPending && (
        <Card>
          {/* Tab bar */}
          <div className="flex border-b">
            <button
              onClick={() => setIsCameraMode(false)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                !isCameraMode ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload size={15} /> Upload Photo
            </button>
            <button
              onClick={() => setIsCameraMode(true)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isCameraMode ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera size={15} /> Use Camera
            </button>
          </div>

          <CardContent className="pt-6">
            {/* ── Upload tab ─────────────────────────────────────── */}
            {!isCameraMode && (
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                {previewUrl ? (
                  <div className="space-y-6">
                    <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden border shadow-sm">
                      <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <Button variant="outline" onClick={reset}>Choose Different</Button>
                      <Button size="lg" onClick={handleAnalyze} className="gap-2 font-medium">
                        <UploadCloud size={18} /> Analyze Image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
                      <ImageIcon className="text-muted-foreground" size={32} />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Drag & drop an image here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse from your device</p>
                    </div>
                    <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={onFileChange} />
                    <Button variant="secondary" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                      Select Image
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Camera tab ─────────────────────────────────────── */}
            {isCameraMode && (
              <div className="flex flex-col items-center gap-5">
                {cameraError ? (
                  <div className="w-full rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center space-y-3">
                    <Camera className="mx-auto text-destructive" size={36} />
                    <p className="text-sm text-destructive font-medium">{cameraError}</p>
                    <Button variant="outline" size="sm" onClick={startCamera}>Try Again</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative w-full max-w-lg rounded-xl overflow-hidden border bg-black aspect-video shadow-md">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="text-white animate-spin" size={32} />
                        </div>
                      )}
                      {/* Viewfinder corners */}
                      {cameraReady && (
                        <>
                          <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-sm" />
                          <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-sm" />
                          <span className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-sm" />
                          <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-sm" />
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Point your camera at trash, then tap Capture</p>
                    <Button
                      size="lg"
                      disabled={!cameraReady}
                      onClick={captureAndAnalyze}
                      className="gap-2 font-medium"
                    >
                      <Camera size={18} /> Capture & Analyze
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {analyzeTrash.isError && !analyzeTrash.isPending && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-3">
            <AlertTriangle className="text-destructive" size={36} />
            <div>
              <h3 className="text-lg font-semibold text-destructive">Analysis Failed</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {analysisErrorMessage}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {analyzeTrash.isPending && (
        <Card className="border-primary/20 shadow-md">
          <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Leaf className="text-primary animate-pulse" size={24} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Running Computer Vision Analysis</h3>
              <p className="text-muted-foreground max-w-md">
                Scanning for objects, classifying materials, and determining recyclability protocols...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Analysis Complete</h2>
            <Button variant="outline" onClick={reset}>Analyze Another</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detected Items</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> Recyclable</span>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span> Non-recyclable</span>
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md overflow-hidden border relative">
                    {previewUrl ? (
                      <>
                        <img
                          ref={imgRef}
                          src={previewUrl}
                          alt="Uploaded trash"
                          className="w-full h-auto block"
                          onLoad={() => result?.items && drawBoxes(result.items as ItemWithBox[])}
                        />
                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        />
                      </>
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center">
                        <ImageIcon className="text-muted-foreground" size={32} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Overall Composition</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-medium text-sm text-muted-foreground">Recyclable Content</span>
                      <span className="text-2xl font-bold">{Math.round(result.overallRecyclablePercent)}%</span>
                    </div>
                    <Progress value={result.overallRecyclablePercent} className="h-3 bg-secondary" />
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg text-sm border font-mono">
                    {result.summary}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary" size={20} />
                    Items Detected ({result.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.items.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-card shadow-sm flex flex-col space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-lg leading-tight">{item.name}</h4>
                        {item.recyclable ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">Recyclable</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">Non-Recyclable</Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary" className="font-mono">{item.category}</Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                          {Math.round(item.confidence * 100)}% Match
                        </Badge>
                      </div>

                      <Separator />
                      
                      <div className="text-sm space-y-2 flex-1">
                        <p className="flex items-start gap-2">
                          <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{item.handlingInstructions}</span>
                        </p>
                        {item.binCategory && (
                          <p className="flex items-center gap-2 font-medium">
                            <Trash2 size={14} className="text-primary" />
                            Bin: {item.binCategory}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(result.cleaningDriveGuide || result.smartBinGuide) && (
                  <Card className="sm:col-span-2 bg-primary/5 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Recycle size={20} className="text-primary" />
                        Action Guides
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {result.cleaningDriveGuide && (
                        <div>
                          <span className="font-semibold block mb-1">Cleaning Drive Guide:</span>
                          <span className="text-muted-foreground">{result.cleaningDriveGuide}</span>
                        </div>
                      )}
                      {result.smartBinGuide && (
                        <div>
                          <span className="font-semibold block mb-1">Smart Bin Segregation:</span>
                          <span className="text-muted-foreground">{result.smartBinGuide}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-primary">Recyclable Zones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{result.recyclableZones}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-destructive flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Non-Recyclable Zones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{result.nonRecyclableZones}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
