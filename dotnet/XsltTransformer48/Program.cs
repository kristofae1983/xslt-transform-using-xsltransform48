using System;
using System.IO;
using System.Xml;
using System.Xml.Xsl;
using System.Security;
using System.Security.Policy;
using System.Security.Permissions;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Usage: XsltTransformer <xmlPath> <xsltPath> <outputPath>");
            return 1;
        }

        // Convert all paths to absolute paths
        string xmlPath = Path.GetFullPath(args[0]);
        string xsltPath = Path.GetFullPath(args[1]);
        string outputPath = Path.GetFullPath(args[2]);
/*
        // Create permission sets
        FileIOPermission readPermission = new FileIOPermission(FileIOPermissionAccess.Read, new string[] { xmlPath, xsltPath });
        FileIOPermission writePermission = new FileIOPermission(FileIOPermissionAccess.Write, outputPath);

        // Use PermissionSet to combine permissions
        PermissionSet permissions = new PermissionSet(PermissionState.None);
        permissions.AddPermission(readPermission);
        permissions.AddPermission(writePermission);

        // Assert all permissions at once
        permissions.Assert();
*/
        try
        {
            // Configure XSLT settings with script support
            XsltSettings settings = new XsltSettings(true, true);
            settings.EnableScript = true;

            // Set up secure resolver with evidence
            XmlUrlResolver resolver = new XmlUrlResolver();
            Evidence evidence = null;

            try
            {
                evidence = XmlSecureResolver.CreateEvidenceForUrl(xsltPath);
            }
            catch (SecurityException)
            {
                // Fallback for local files
                evidence = new Evidence();
            }

            XmlSecureResolver secureResolver = new XmlSecureResolver(resolver, evidence);

            // Load and transform
            XslCompiledTransform xslt = new XslCompiledTransform();
            xslt.Load(xsltPath, settings, secureResolver);

            // Configure output settings
            XmlWriterSettings writerSettings = new XmlWriterSettings();
            writerSettings.Indent = true;

            using (XmlWriter writer = XmlWriter.Create(outputPath, writerSettings))
            {
                xslt.Transform(xmlPath, writer);
            }

            Console.WriteLine("Transformation successful!");
            return 0;
        }
        catch (XsltException ex)
        {
            Console.Error.WriteLine($"XSLT ERROR (Line {ex.LineNumber}, Pos {ex.LinePosition}): {ex.Message}");
            return 2;
        }
        catch (XmlException ex)
        {
            Console.Error.WriteLine($"XML ERROR (Line {ex.LineNumber}, Pos {ex.LinePosition}): {ex.Message}");
            return 3;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"ERROR: {ex.GetType().Name}: {ex.Message}");
            return 1;
        }
        finally
        {
            // Always revert the assertion when done
            CodeAccessPermission.RevertAssert();
        }
    }
}