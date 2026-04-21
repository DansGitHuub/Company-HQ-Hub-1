import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, Leaf } from "lucide-react";

const BUDGET_RANGES = ["$1k-$5k", "$5k-$15k", "$15k-$30k", "$30k-$60k", "$60k+", "Not Sure"];
const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"];
const HOW_HEARD = ["Google", "Google Maps", "Referral", "Trucks", "Social Media", "Nextdoor", "Other"];
const TIMELINES = ["ASAP", "Within 1 month", "1-3 months", "3-6 months", "6+ months", "Just planning"];

interface ServiceType { id: string; name: string; category: string; }

export default function InquiryPage() {
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    property_address: "", best_time_to_reach: "", how_heard: "",
    service_type: "", project_type: "new_project",
    project_description: "", desired_timeline: "", budget_range: "",
    additional_notes: "", agreement_accepted: false,
  });

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [stLoaded, setStLoaded] = useState(false);

  if (!stLoaded) {
    fetch("/api/service-types/active")
      .then(r => r.json())
      .then(data => { setServiceTypes(data); setStLoaded(true); })
      .catch(() => setStLoaded(true));
  }

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  function handlePhotoAdd(files: FileList | null) {
    if (!files) return;
    const newPhotos = Array.from(files).slice(0, 5 - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.first_name || !form.last_name || !form.email) {
      setError("Please fill in your name and email.");
      return;
    }
    if (!form.project_description.trim()) {
      setError("Please describe your project.");
      return;
    }
    if (!form.agreement_accepted) {
      setError("Please accept the agreement to continue.");
      return;
    }

    setSubmitting(true);
    try {
      // Upload photos first
      const photoUrls: string[] = [];
      for (const p of photos) {
        const fd = new FormData();
        fd.append("file", p.file);
        try {
          const res = await fetch("/api/hq/upload", { method: "POST", body: fd });
          if (res.ok) {
            const data = await res.json();
            photoUrls.push(data.url || data.objectUrl || "");
          }
        } catch {}
      }

      const res = await fetch("/api/inquiry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photo_urls: photoUrls }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      navigate("/inquiry/success");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-800">Chapin Landscapes</h1>
              <p className="text-sm text-green-600">Professional Landscape Management</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Request a Free Estimate</h2>
          <p className="text-gray-500 mt-2">Fill out the form below and we'll be in touch shortly.</p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>First Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.first_name}
                    onChange={e => f("first_name", e.target.value)}
                    placeholder="John"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.last_name}
                    onChange={e => f("last_name", e.target.value)}
                    placeholder="Smith"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Email Address <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => f("email", e.target.value)}
                    placeholder="john@email.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={e => f("phone", e.target.value)}
                    placeholder="(555) 000-0000"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <Label>Property Address</Label>
                <Input
                  value={form.property_address}
                  onChange={e => f("property_address", e.target.value)}
                  placeholder="123 Main St, City, MA 01234"
                  data-testid="input-address"
                />
              </div>

              {/* Best time & How heard */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Best Time to Reach</Label>
                  <Select value={form.best_time_to_reach || "_none"} onValueChange={v => f("best_time_to_reach", v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-best-time"><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Anytime —</SelectItem>
                      {BEST_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>How Did You Hear About Us?</Label>
                  <Select value={form.how_heard || "_none"} onValueChange={v => f("how_heard", v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-how-heard"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Select —</SelectItem>
                      {HOW_HEARD.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Service Type */}
              <div className="space-y-1">
                <Label>Service Type</Label>
                <Select value={form.service_type || "_none"} onValueChange={v => f("service_type", v === "_none" ? "" : v)}>
                  <SelectTrigger data-testid="select-service-type"><SelectValue placeholder="Select service..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Select —</SelectItem>
                    {serviceTypes.map(st => <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Type */}
              <div className="space-y-2">
                <Label>Project Type</Label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="project_type"
                      value="new_project"
                      checked={form.project_type === "new_project"}
                      onChange={() => f("project_type", "new_project")}
                      data-testid="radio-new-project"
                    />
                    <span>New Project</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="project_type"
                      value="maintenance"
                      checked={form.project_type === "maintenance"}
                      onChange={() => f("project_type", "maintenance")}
                      data-testid="radio-maintenance"
                    />
                    <span>Maintenance</span>
                  </label>
                </div>
              </div>

              {/* Project Description */}
              <div className="space-y-1">
                <Label>Project Description <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={4}
                  value={form.project_description}
                  onChange={e => f("project_description", e.target.value)}
                  placeholder="Please describe your project, property size, specific needs, or any other details that would help us understand your vision..."
                  data-testid="input-project-description"
                />
              </div>

              {/* Timeline & Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Desired Timeline</Label>
                  <Select value={form.desired_timeline || "_none"} onValueChange={v => f("desired_timeline", v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-timeline"><SelectValue placeholder="When..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Not sure —</SelectItem>
                      {TIMELINES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Budget Range</Label>
                  <Select value={form.budget_range || "_none"} onValueChange={v => f("budget_range", v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-budget"><SelectValue placeholder="Select range..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Not sure —</SelectItem>
                      {BUDGET_RANGES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1">
                <Label>Additional Notes</Label>
                <Textarea
                  rows={2}
                  value={form.additional_notes}
                  onChange={e => f("additional_notes", e.target.value)}
                  placeholder="Anything else you'd like us to know..."
                  data-testid="input-additional-notes"
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photos (optional, up to 5)</Label>
                <p className="text-xs text-gray-500">Share photos of your property or project area to help us give you a more accurate estimate.</p>
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
                    data-testid="btn-upload-photo"
                  >
                    <Upload className="h-4 w-4" /> Add Photos
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoAdd(e.target.files)}
                />
                {photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((p, idx) => (
                      <div key={idx} className="relative w-20 h-20">
                        <img src={p.preview} alt="" className="w-full h-full object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agreement */}
              <div className="rounded-lg border bg-gray-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agreement_accepted}
                    onChange={e => f("agreement_accepted", e.target.checked)}
                    className="mt-1 h-4 w-4"
                    data-testid="checkbox-agreement"
                  />
                  <span className="text-sm text-gray-600">
                    By submitting this form, I agree to be contacted by Chapin Landscapes regarding my project inquiry.
                    I understand that submitting this form does not obligate me to any service or purchase.
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="error-message">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-700 hover:bg-green-800 text-white py-3 text-base font-semibold"
                data-testid="btn-submit-inquiry"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  "Submit Inquiry"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Chapin Landscapes LLC — All rights reserved
        </p>
      </div>
    </div>
  );
}
