import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Phone, Building2, User } from "lucide-react";
import type { Listing } from "@/lib/db-types";

export function ContactCard({ listing }: { listing: Listing }) {
  const hasContact =
    listing.contact_name ||
    listing.contact_phone ||
    listing.contact_email ||
    listing.contact_company;

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Kontakt</h2>
        {hasContact ? (
          <div className="space-y-2 text-sm">
            {listing.contact_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{listing.contact_name}</span>
              </div>
            )}
            {listing.contact_company && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{listing.contact_company}</span>
              </div>
            )}
            {listing.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${listing.contact_phone}`} className="text-primary hover:underline">
                  {listing.contact_phone}
                </a>
              </div>
            )}
            {listing.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${listing.contact_email}`} className="text-primary hover:underline">
                  {listing.contact_email}
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Keine Kontaktdaten erfasst. Bitte das Original-Inserat öffnen.
          </p>
        )}
        {listing.primary_url && (
          <Button asChild className="w-full" variant="default">
            <a href={listing.primary_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Original-Inserat öffnen
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
