-- Add cancelled status to request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'cancelled';