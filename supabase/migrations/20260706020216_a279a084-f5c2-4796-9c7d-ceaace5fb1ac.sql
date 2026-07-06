
CREATE POLICY "artworks_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'artworks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "artworks_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'artworks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "artworks_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'artworks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "artworks_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'artworks' AND (storage.foldername(name))[1] = auth.uid()::text);
