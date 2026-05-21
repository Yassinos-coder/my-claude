# Exemples de recaps

Reproduire ce style exact : ton, structure, niveau de detail, formatage.

---

## Exemple 1 — Fonctionnalite avec liste de sous-fonctionnalites

Update - Messagerie entre eleves et tuteurs dans la plateforme d'apprentissage

J'ai integre une nouvelle fonctionnalite de messagerie directe entre les apprenants et leurs tuteurs dans la plateforme d'apprentissage pour toutes les filiales.

Fonctionnalites principales
* **Messagerie directe** — Les apprenants et tuteurs peuvent maintenant communiquer directement via un systeme de chat integre a la plateforme
* **Association automatique** — Le tuteur voit automatiquement tous les apprenants avec lesquels il est jumele dans un mandat et peut leur ecrire. De meme, l'apprenant voit automatiquement tous ses tuteurs assignes
* **Historique des conversations** — Toutes les discussions sont sauvegardees et accessibles pour consulter l'historique complet
* **Securite et permissions** — Le systeme verifie automatiquement que l'apprenant et le tuteur sont bien jumeles dans un mandat avant d'autoriser l'echange de messages

Le backend et le frontend sont implementes a 100% et peuvent etre transposes a toutes les filiales.

Les seules fonctionnalites manquantes sont l'affichage en temps reel des messages et la possibilite de supprimer des messages, qui peuvent etre implementees au besoin :slightly_smiling_face:

---

## Exemple 2 — Fonctionnalite complexe avec sous-sections detaillees

Update - Gestion autonome des abonnements — Fonctionnalites en ligne

Les clients ont desormais la possibilite de gerer leur abonnement de maniere autonome depuis leur compte, sans avoir a passer par nous.

Points d'acces

La gestion de l'abonnement est accessible via deux chemins :
Un bouton **"Gerer mon abonnement"** qui apparait dans la page de facturation, uniquement si le client est actuellement abonne.
L'option **"Mes abonnements"** dans le menu deroulant utilisateur de l'espace d'apprentissage.

Pause de l'abonnement

Le client peut mettre son abonnement en pause pour une duree de 14 jours, 1 mois, 2 mois ou 3 mois.
Lors d'une mise en pause, un email est automatiquement envoye en interne a Audrey-Anne ainsi qu'a Christopher (pour les clients Clinique), contenant l'identifiant du client et les informations pertinentes.

Annulation de l'abonnement

Le client peut annuler son abonnement. L'annulation prend effet immediatement et declenche le meme processus de notification par email que pour la pause.
:warning: Cette fonctionnalite est actuellement desactivee pour les clients Clinique, le temps de finaliser les modalites exactes d'annulation pour cette filiale.

Changement de plan

Le client peut passer a l'un des autres plans disponibles.
Note : le passage d'un cours en ligne a un cours a domicile (et inversement) n'est pas inclus pour le moment, afin d'eviter des complexites de gestion.
