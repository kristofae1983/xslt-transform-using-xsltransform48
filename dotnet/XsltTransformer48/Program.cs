using System;
using System.IO;
using System.Xml;
using System.Xml.Xsl;
using System.Security;
using System.Security.Policy;

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

        // Parse parameters: expect pairs of name and value after the first three arguments
        XsltArgumentList xsltArgs = new XsltArgumentList();
        for (int i = 3; i < args.Length; i++)
        {
            var param = args[i];
            var eqIdx = param.IndexOf('=');
            if (eqIdx > 0)
            {
                string paramName = param.Substring(0, eqIdx);
                string paramValue = param.Substring(eqIdx + 1);
                xsltArgs.AddParam(paramName, string.Empty, paramValue);
            }
        }

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
                xslt.Transform(xmlPath, xsltArgs, writer);
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
    }
}