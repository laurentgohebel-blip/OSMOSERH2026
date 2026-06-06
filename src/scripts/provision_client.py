#!/usr/bin/env python3
"""
Provision de base pour un **site client existant** :
- crée les listes Contrats / BoiteIdees / DPAE / Conges / Onboarding si absentes
- ajoute quelques colonnes standards
- crée la bibliothèque "Contrats" si absente

Prérequis :
- .env rempli (TENANT_ID, CLIENT_ID, CLIENT_SECRET)
- L'app a reçu un **grant RSC** (Sites.Selected) sur le site cible avec un rôle suffisant (write/manage)

Usage :
  python scripts/provision_client.py --site-host <tenant>.sharepoint.com --site-path /sites/SYN-CLIENT
"""
import argparse
import os
from dotenv import load_dotenv
from backend.sp_client import get_site_id, ensure_list, add_text_column, add_number_column, add_choice_column, get_drive_id_by_name

load_dotenv()

parser = argparse.ArgumentParser()
parser.add_argument('--site-host', required=True)
parser.add_argument('--site-path', required=True)
args = parser.parse_args()

site_id = get_site_id(args.site_host, args.site_path)
print(f"Site ID: {site_id}")

# Listes
contrats_id    = ensure_list(site_id, 'Contrats')
ideas_id       = ensure_list(site_id, 'BoiteIdees')
dpae_id        = ensure_list(site_id, 'DPAE')
conges_id      = ensure_list(site_id, 'Conges')
onboarding_id  = ensure_list(site_id, 'Onboarding')
print('Lists:', contrats_id, ideas_id, dpae_id, conges_id, onboarding_id)

# Colonnes Contrats
try:
    add_text_column(site_id, contrats_id, 'Poste')
    add_text_column(site_id, contrats_id, 'TypeContrat')
    add_text_column(site_id, contrats_id, 'Notes')
    add_number_column(site_id, contrats_id, 'SalaireBrut')
    add_text_column(site_id, contrats_id, 'DateDebut')  # simplifié en texte ISO yyyy-mm-dd
except Exception as e:
    print('Columns (Contrats):', e)

# Colonnes BoiteIdees
try:
    add_text_column(site_id, ideas_id, 'Description')
    add_text_column(site_id, ideas_id, 'Auteur')
except Exception as e:
    print('Columns (BoiteIdees):', e)

# Colonnes DPAE
try:
    add_text_column(site_id, dpae_id, 'SIRET')
    add_text_column(site_id, dpae_id, 'Nom')
    add_text_column(site_id, dpae_id, 'Prenom')
    add_text_column(site_id, dpae_id, 'DateNaissance')
    add_text_column(site_id, dpae_id, 'DateDebut')
    add_text_column(site_id, dpae_id, 'TypeContrat')
    add_choice_column(site_id, dpae_id, 'Statut', ['A traiter','Envoyée','Refusée'])
except Exception as e:
    print('Columns (DPAE):', e)

# Colonnes Conges
try:
    add_text_column(site_id, conges_id, 'EmployeeEmail')
    add_text_column(site_id, conges_id, 'EmployeeName')
    add_text_column(site_id, conges_id, 'Type')
    add_text_column(site_id, conges_id, 'StartDate')
    add_text_column(site_id, conges_id, 'EndDate')
    add_text_column(site_id, conges_id, 'StartHalf')
    add_text_column(site_id, conges_id, 'EndHalf')
    add_number_column(site_id, conges_id, 'Days')
    add_choice_column(site_id, conges_id, 'Statut', ['pending', 'approved', 'rejected', 'canceled'])
    add_text_column(site_id, conges_id, 'Comment')
    add_text_column(site_id, conges_id, 'ManagerComment')
    add_text_column(site_id, conges_id, 'CreatedAt')
    print(f'Colonnes Conges créées sur liste {conges_id}')
except Exception as e:
    print('Columns (Conges):', e)

# Colonnes Onboarding
try:
    add_text_column(site_id, onboarding_id, 'EmployeeName')
    add_text_column(site_id, onboarding_id, 'EmployeeEmail')
    add_text_column(site_id, onboarding_id, 'Position')
    add_text_column(site_id, onboarding_id, 'Department')
    add_text_column(site_id, onboarding_id, 'Manager')
    add_text_column(site_id, onboarding_id, 'StartDate')
    add_choice_column(site_id, onboarding_id, 'Status', ['in_progress', 'completed', 'canceled'])
    add_text_column(site_id, onboarding_id, 'TasksJson')   # JSON serialisé des tâches
    add_text_column(site_id, onboarding_id, 'CreatedAt')
    print(f'Colonnes Onboarding créées sur liste {onboarding_id}')
except Exception as e:
    print('Columns (Onboarding):', e)

# Bibliothèque Contrats
try:
    drive_id = get_drive_id_by_name(site_id, 'Contrats')
    print('Drive Contrats:', drive_id)
except Exception as e:
    print('Drive (Contrats):', e)
