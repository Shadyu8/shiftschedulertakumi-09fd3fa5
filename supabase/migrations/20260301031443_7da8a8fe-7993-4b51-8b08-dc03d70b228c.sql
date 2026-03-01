
-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true);

-- Allow authenticated users to upload their own profile picture
CREATE POLICY "Users upload own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own profile picture
CREATE POLICY "Users update own profile picture"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own profile picture
CREATE POLICY "Users delete own profile picture"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to profile pictures
CREATE POLICY "Public read profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');
