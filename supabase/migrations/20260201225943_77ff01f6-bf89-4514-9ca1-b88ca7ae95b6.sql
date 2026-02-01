-- Add admin policy to allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy to allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy to allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy to insert credit_transactions for users
CREATE POLICY "Admins can insert credit transactions" 
ON public.credit_transactions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add admin policy to view all credit_transactions
CREATE POLICY "Admins can view all transactions" 
ON public.credit_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy to view all stripe_payments
CREATE POLICY "Admins can view all payments" 
ON public.stripe_payments 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add admin policy to update stripe_payments
CREATE POLICY "Admins can update payments" 
ON public.stripe_payments 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Assign admin role to adriendemerville@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'adriendemerville@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;