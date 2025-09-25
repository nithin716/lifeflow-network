import { Heart } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-soft-gray border-t border-border/40 py-6 mt-12">
      <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span>Developed with</span>
          <Heart className="h-4 w-4 text-medical-red fill-current" />
          <span>by Nithin Reddaboina</span>
        </div>
        <div className="mt-2">
          <a 
            href="mailto:nithinyadav370@gmail.com"
            className="text-medical-red hover:underline text-sm"
          >
            📧 nithinyadav370@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
};