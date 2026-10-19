"use client";

import { ArrowRight, FlaskConical, Mail } from "lucide-react";
import Modal from "./Modal";

export default function AlphaDisclaimer({ onContinue }: { onContinue: () => void }) {
  return (
    <Modal title="myAeon is in Alpha" onClose={onContinue}>
      <div className="alpha-notice">
        <img src="/brand/my-aeon-wordmark.png" alt="myAeon" width={1456} height={449} />
        <p className="alpha-notice-label"><FlaskConical size={18} aria-hidden="true" /> In development</p>
        <p className="alpha-notice-intro">An early look, not a finished application.</p>
        <p>
          myAeon is an experimental Alpha. Features are still being built and
          tested, and you may encounter errors, incomplete information or
          unexpected behaviour.
        </p>
        <p>
          Please treat readings and conversations as prompts for reflection, not
          reliable predictions or professional advice.
        </p>
        <p>Your feedback helps shape what comes next.</p>
        <a className="alpha-notice-feedback" href="mailto:info@acuity.institute">
          <Mail size={20} aria-hidden="true" />
          <span>Send feedback<span>info@acuity.institute</span></span>
        </a>
        <button className="alpha-notice-continue" onClick={onContinue}>
          Continue <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
