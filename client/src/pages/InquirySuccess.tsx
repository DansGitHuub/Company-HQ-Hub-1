import { CheckCircle, Leaf, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InquirySuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-14 h-14 bg-green-700 rounded-full flex items-center justify-center">
            <Leaf className="h-7 w-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-green-800">Chapin Landscapes</h1>
            <p className="text-sm text-green-600">Professional Landscape Management</p>
          </div>
        </div>

        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-14 w-14 text-green-600" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-gray-800">Inquiry Received!</h2>
          <p className="text-gray-500 text-lg">
            Thank you for reaching out to Chapin Landscapes.
          </p>
          <p className="text-gray-500">
            Our team has received your inquiry and will be in touch within <strong>24 business hours</strong> to discuss your project and schedule a free consultation.
          </p>
        </div>

        {/* What's next */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-left space-y-3">
          <h3 className="font-bold text-green-800">What Happens Next?</h3>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-green-700 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              <span>Our team will review your inquiry and any photos you uploaded.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-green-700 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
              <span>A project manager will contact you to discuss your needs and schedule a site visit.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-green-700 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
              <span>We'll provide a detailed, no-obligation estimate for your project.</span>
            </li>
          </ol>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Need immediate assistance?</p>
          <div className="flex justify-center">
            <a
              href="mailto:info@chapinlandscapes.com"
              className="flex items-center justify-center gap-2 px-5 py-2.5 border border-green-700 text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors"
            >
              <Mail className="h-4 w-4" /> Email Us
            </a>
          </div>
        </div>

        <Button
          variant="ghost"
          className="text-gray-400 hover:text-gray-600"
          onClick={() => window.location.href = "/inquiry"}
        >
          Submit Another Inquiry
        </Button>

        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Chapin Landscapes LLC — All rights reserved
        </p>
      </div>
    </div>
  );
}
